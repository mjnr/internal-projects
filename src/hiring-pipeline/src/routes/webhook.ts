import { Router, Request, Response } from 'express';
import { Application } from '../models/application.js';
import {
  getScrapingResults,
  convertToMarkdown,
  type ApifyDatasetItem,
} from '../services/apify.js';
import { evaluateCandidate } from '../services/ai-screener.js';
import { sendChallengeEmail } from '../services/resend.js';
import {
  notifyQualifiedCandidate,
  notifyRejectedCandidate,
} from '../services/roam.js';
import { getRole } from '../config/roles.js';
import type { LinkedInProfile } from '../models/application.js';

const router = Router();

/**
 * Converte dados do Apify para o formato do modelo
 */
function parseApifyProfile(data: ApifyDatasetItem): LinkedInProfile {
  return {
    headline: data.headline,
    location: data.location,
    summary: data.summary,
    education: (data.education || []).map((edu) => ({
      school: edu.schoolName || 'Unknown',
      degree: edu.degreeName,
      field: edu.fieldOfStudy,
    })),
    experience: (data.experience || []).map((exp) => ({
      company: exp.companyName || 'Unknown',
      title: exp.title || 'Unknown',
      location: exp.location,
      startDate: exp.dateRange?.split(' - ')[0],
      endDate: exp.dateRange?.split(' - ')[1],
      description: exp.description,
    })),
    skills: data.skills || [],
    rawMarkdown: convertToMarkdown(data),
  };
}

/**
 * Processa o candidato após o scraping
 */
async function processCandidate(applicationId: string): Promise<void> {
  const application = await Application.findById(applicationId);

  if (!application) {
    console.error(`Application not found: ${applicationId}`);
    return;
  }

  if (!application.apifyRunId) {
    console.error(`No Apify run ID for application: ${applicationId}`);
    application.status = 'error';
    application.errorMessage = 'Missing Apify run ID';
    await application.save();
    return;
  }

  try {
    // Buscar resultados do scraping
    console.log(`📥 Fetching scraping results for ${application.name}...`);
    const scrapingData = await getScrapingResults(application.apifyRunId);

    if (!scrapingData) {
      application.status = 'error';
      application.errorMessage = 'No profile data returned from scraping';
      await application.save();
      return;
    }

    // Converter e salvar dados do LinkedIn
    application.linkedinProfile = parseApifyProfile(scrapingData);
    application.status = 'evaluating';
    await application.save();

    console.log(`🤖 Evaluating candidate ${application.name}...`);

    // Avaliar com AI
    const evaluation = await evaluateCandidate(
      application.linkedinProfile,
      application.name
    );

    application.evaluation = evaluation;
    application.status = evaluation.qualified ? 'qualified' : 'rejected';
    await application.save();

    console.log(
      `✅ Evaluation complete: ${application.name} - Score: ${evaluation.score}, Qualified: ${evaluation.qualified}`
    );

    // Processar notificações
    if (evaluation.qualified) {
      // Enviar email com teste técnico
      const role = getRole(application.role);
      if (role) {
        try {
          await sendChallengeEmail({
            to: application.email,
            name: application.name,
            githubChallengeUrl: role.githubChallengeUrl,
            roleName: role.name,
          });
          application.notifications.emailSentAt = new Date();
          await application.save();
        } catch (emailError) {
          console.error('Failed to send email:', emailError);
        }
      }

      // Notificar no Roam
      try {
        await notifyQualifiedCandidate(application);
        application.notifications.roamNotifiedAt = new Date();
        await application.save();
      } catch (roamError) {
        console.error('Failed to notify on Roam:', roamError);
      }
    } else {
      // Notificar rejeição no Roam
      try {
        await notifyRejectedCandidate(application);
        application.notifications.roamNotifiedAt = new Date();
        await application.save();
      } catch (roamError) {
        console.error('Failed to notify rejection on Roam:', roamError);
      }
    }
  } catch (error) {
    console.error(`Error processing candidate ${application.name}:`, error);
    application.status = 'error';
    application.errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    await application.save();
  }
}

/**
 * POST /webhook/apify
 * Callback do Apify quando o scraping termina
 */
router.post('/apify', async (req: Request, res: Response) => {
  try {
    const applicationId = req.query.applicationId as string;

    if (!applicationId) {
      console.error('Apify webhook: Missing applicationId');
      return res.status(400).json({ error: 'Missing applicationId' });
    }

    // Verificar o evento do webhook
    const eventType = req.body?.eventType || req.body?.resource?.eventType;

    console.log(`🔔 Apify webhook received: ${eventType} for ${applicationId}`);

    if (eventType === 'ACTOR.RUN.FAILED') {
      const application = await Application.findById(applicationId);
      if (application) {
        application.status = 'error';
        application.errorMessage = 'LinkedIn scraping failed';
        await application.save();
      }
      return res.json({ received: true, status: 'failed' });
    }

    // Se o scraping foi bem sucedido, processar o candidato
    // Fazer de forma assíncrona para não bloquear o webhook
    setImmediate(() => {
      processCandidate(applicationId).catch((err) => {
        console.error('Error in async processing:', err);
      });
    });

    return res.json({ received: true, status: 'processing' });
  } catch (error) {
    console.error('Apify webhook error:', error);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
});

export { router as webhookRouter };

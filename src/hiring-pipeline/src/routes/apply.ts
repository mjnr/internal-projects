import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { Application } from '../models/application.js';
import { startLinkedInScraping } from '../services/apify.js';
import { isValidRole, getActiveRoles } from '../config/roles.js';

const router = Router();

// Schema de validação para candidatura
const applySchema = z.object({
  name: z
    .string()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(100, 'Nome deve ter no máximo 100 caracteres'),
  email: z.string().email('Email inválido'),
  phone: z
    .string()
    .min(10, 'Telefone deve ter pelo menos 10 dígitos')
    .max(20, 'Telefone deve ter no máximo 20 caracteres'),
  linkedinUrl: z
    .string()
    .url('URL do LinkedIn inválida')
    .refine(
      (url) => url.includes('linkedin.com/in/'),
      'URL deve ser um perfil do LinkedIn válido'
    ),
  role: z.string().min(1, 'Vaga é obrigatória'),
});

type ApplyInput = z.infer<typeof applySchema>;

/**
 * POST /apply
 * Recebe uma nova candidatura
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    // Validar input
    const parseResult = applySchema.safeParse(req.body);

    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Dados inválidos',
        details: parseResult.error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      });
    }

    const input: ApplyInput = parseResult.data;

    // Validar se a vaga existe e está ativa
    if (!isValidRole(input.role)) {
      const activeRoles = getActiveRoles();
      return res.status(400).json({
        error: 'Vaga não encontrada ou inativa',
        availableRoles: activeRoles.map((r) => ({
          slug: r.slug,
          name: r.name,
        })),
      });
    }

    // Verificar se já existe candidatura com mesmo email para mesma vaga
    const existingApplication = await Application.findOne({
      email: input.email.toLowerCase(),
      role: input.role,
      status: { $in: ['pending', 'scraping', 'evaluating', 'qualified'] },
    });

    if (existingApplication) {
      return res.status(409).json({
        error: 'Você já possui uma candidatura em andamento para esta vaga',
        applicationId: existingApplication._id,
        status: existingApplication.status,
      });
    }

    // Criar candidatura
    const application = new Application({
      name: input.name,
      email: input.email.toLowerCase(),
      phone: input.phone,
      linkedinUrl: input.linkedinUrl,
      role: input.role,
      status: 'pending',
    });

    await application.save();

    console.log(
      `📝 New application: ${application.name} (${application.email}) for ${application.role}`
    );

    // Iniciar scraping do LinkedIn de forma assíncrona
    try {
      application.status = 'scraping';
      const runId = await startLinkedInScraping(
        input.linkedinUrl,
        application._id.toString()
      );
      application.apifyRunId = runId;
      await application.save();

      console.log(`🔍 Started LinkedIn scraping: ${runId}`);
    } catch (scrapingError) {
      console.error('Failed to start scraping:', scrapingError);
      application.status = 'error';
      application.errorMessage = 'Failed to start LinkedIn scraping';
      await application.save();
    }

    // Retornar resposta imediata
    return res.status(202).json({
      message: 'Candidatura recebida com sucesso! Estamos analisando seu perfil.',
      applicationId: application._id,
      status: application.status,
    });
  } catch (error) {
    console.error('Error processing application:', error);
    return res.status(500).json({ error: 'Erro interno ao processar candidatura' });
  }
});

/**
 * GET /apply/roles
 * Lista vagas disponíveis
 */
router.get('/roles', (_req: Request, res: Response) => {
  const activeRoles = getActiveRoles();
  return res.json({
    roles: activeRoles.map((r) => ({
      slug: r.slug,
      name: r.name,
      description: r.description,
    })),
  });
});

/**
 * GET /apply/:id
 * Consulta status de uma candidatura
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const application = await Application.findById(req.params.id);

    if (!application) {
      return res.status(404).json({ error: 'Candidatura não encontrada' });
    }

    return res.json({
      id: application._id,
      name: application.name,
      role: application.role,
      status: application.status,
      qualified: application.evaluation?.qualified,
      createdAt: application.createdAt,
    });
  } catch (error) {
    console.error('Error fetching application:', error);
    return res.status(500).json({ error: 'Erro ao buscar candidatura' });
  }
});

export { router as applyRouter };

import { env } from '../config/env.js';
import type { IApplication } from '../models/application.js';
import { generateWhatsAppLink } from '../utils/whatsapp.js';
import { getRole } from '../config/roles.js';

const ROAM_API_URL = 'https://api.roam.ai/v1';

interface RoamMessagePayload {
  chatId: string;
  message: string;
}

/**
 * Envia mensagem para o chat do Roam
 */
async function sendRoamMessage(message: string): Promise<void> {
  const payload: RoamMessagePayload = {
    chatId: env.ROAM_CONVERSION_CHAT_ID,
    message,
  };

  const response = await fetch(`${ROAM_API_URL}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.ROAM_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Roam API error: ${response.status} - ${error}`);
  }
}

/**
 * Notifica candidato qualificado no Roam
 */
export async function notifyQualifiedCandidate(
  application: IApplication
): Promise<void> {
  const role = getRole(application.role);
  const roleName = role?.name || application.role;
  const whatsappLink = generateWhatsAppLink(application.phone, application.name);

  const bullets = application.evaluation?.bullets || [];
  const bulletPoints = bullets.map((b) => `• ${b}`).join('\n');

  const message = `🎯 Novo candidato QUALIFICADO

👤 Nome: ${application.name}
📧 Email: ${application.email}
📱 Telefone: ${application.phone}
💼 Vaga: ${roleName}
⭐ Score: ${application.evaluation?.score || 0}/20

📋 Resumo:
${bulletPoints}

📱 WhatsApp: ${whatsappLink}
✅ Teste técnico enviado por email

🔗 LinkedIn: ${application.linkedinUrl}`;

  try {
    await sendRoamMessage(message);
    console.log(`✅ Roam notification sent for ${application.name}`);
  } catch (error) {
    console.error(`❌ Failed to send Roam notification:`, error);
    throw error;
  }
}

/**
 * Notifica candidato não qualificado no Roam
 */
export async function notifyRejectedCandidate(
  application: IApplication
): Promise<void> {
  const role = getRole(application.role);
  const roleName = role?.name || application.role;
  const whatsappLink = generateWhatsAppLink(application.phone, application.name);

  const bullets = application.evaluation?.bullets || [];
  const bulletPoints = bullets.map((b) => `• ${b}`).join('\n');

  const message = `❌ Candidato não qualificado

👤 Nome: ${application.name}
📧 Email: ${application.email}
💼 Vaga: ${roleName}
⭐ Score: ${application.evaluation?.score || 0}/20 (mínimo: ${env.SCORE_THRESHOLD})

📋 Resumo:
${bulletPoints}

📱 WhatsApp: ${whatsappLink}
🔗 LinkedIn: ${application.linkedinUrl}`;

  try {
    await sendRoamMessage(message);
    console.log(`✅ Roam notification sent for rejected candidate ${application.name}`);
  } catch (error) {
    console.error(`❌ Failed to send Roam notification:`, error);
    throw error;
  }
}

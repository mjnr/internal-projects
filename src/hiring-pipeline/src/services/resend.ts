import { Resend } from 'resend';
import { env } from '../config/env.js';

const resend = new Resend(env.RESEND_API_KEY);

interface SendChallengeEmailParams {
  to: string;
  name: string;
  githubChallengeUrl: string;
  roleName: string;
}

/**
 * Envia email com o teste técnico para candidatos qualificados
 */
export async function sendChallengeEmail(
  params: SendChallengeEmailParams
): Promise<void> {
  const { to, name, githubChallengeUrl, roleName } = params;

  try {
    const result = await resend.emails.send({
      from: env.RESEND_FROM_EMAIL,
      to,
      subject: `Próximo passo: Teste Técnico para ${roleName} na Voidr`,
      // Usando template do Resend
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #1a1a1a; font-size: 24px; margin-bottom: 20px;">Olá, ${name}! 👋</h1>
          
          <p style="color: #333; font-size: 16px; line-height: 1.6;">
            Ficamos muito felizes com a sua candidatura para a vaga de <strong>${roleName}</strong> na Voidr!
          </p>
          
          <p style="color: #333; font-size: 16px; line-height: 1.6;">
            Analisamos seu perfil e gostaríamos de avançar para a próxima etapa do processo seletivo: 
            o <strong>Teste Técnico</strong>.
          </p>
          
          <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 24px 0;">
            <h2 style="color: #1a1a1a; font-size: 18px; margin-top: 0;">📋 Instruções</h2>
            <ol style="color: #333; font-size: 15px; line-height: 1.8; padding-left: 20px;">
              <li>Acesse o repositório do teste no link abaixo</li>
              <li>Leia atentamente o README com as instruções</li>
              <li>Faça um fork do repositório</li>
              <li>Complete o desafio no seu tempo (recomendamos até 7 dias)</li>
              <li>Envie o link do seu repositório respondendo este email</li>
            </ol>
          </div>
          
          <a href="${githubChallengeUrl}" 
             style="display: inline-block; background-color: #0066ff; color: white; padding: 14px 28px; 
                    text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; margin: 16px 0;">
            Acessar Teste Técnico →
          </a>
          
          <p style="color: #666; font-size: 14px; line-height: 1.6; margin-top: 24px;">
            Se tiver qualquer dúvida, é só responder este email que teremos prazer em ajudar.
          </p>
          
          <p style="color: #333; font-size: 16px; line-height: 1.6;">
            Boa sorte! 🚀<br/>
            <strong>Equipe Voidr</strong>
          </p>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;" />
          
          <p style="color: #999; font-size: 12px;">
            Voidr | AI-Powered Test Automation for Mission-Critical Systems<br/>
            <a href="https://voidr.co" style="color: #0066ff;">voidr.co</a>
          </p>
        </div>
      `,
    });

    console.log(`✅ Email sent to ${to}:`, result);
  } catch (error) {
    console.error(`❌ Failed to send email to ${to}:`, error);
    throw error;
  }
}

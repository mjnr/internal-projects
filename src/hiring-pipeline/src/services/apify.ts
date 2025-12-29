import { env } from '../config/env.js';

const APIFY_BASE_URL = 'https://api.apify.com/v2';
const ACTOR_ID = 'curious_coder~linkedin-profile-scraper';

export interface ApifyRunResponse {
  data: {
    id: string;
    status: string;
    startedAt: string;
  };
}

export interface ApifyDatasetItem {
  url?: string;
  fullName?: string;
  headline?: string;
  location?: string;
  summary?: string;
  education?: Array<{
    schoolName?: string;
    degreeName?: string;
    fieldOfStudy?: string;
    dateRange?: string;
  }>;
  experience?: Array<{
    companyName?: string;
    title?: string;
    location?: string;
    dateRange?: string;
    description?: string;
  }>;
  skills?: string[];
  [key: string]: unknown;
}

/**
 * Inicia o scraping do perfil do LinkedIn via Apify
 */
export async function startLinkedInScraping(
  linkedinUrl: string,
  applicationId: string
): Promise<string> {
  const webhookUrl = `${env.WEBHOOK_BASE_URL}/webhook/apify?applicationId=${applicationId}`;

  const response = await fetch(
    `${APIFY_BASE_URL}/acts/${ACTOR_ID}/runs?token=${env.APIFY_TOKEN}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        profileUrls: [linkedinUrl],
        minDelay: 2,
        maxDelay: 5,
        // Configurar webhook para notificar quando terminar
        webhooks: [
          {
            eventTypes: ['ACTOR.RUN.SUCCEEDED', 'ACTOR.RUN.FAILED'],
            requestUrl: webhookUrl,
          },
        ],
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Apify request failed: ${response.status} - ${error}`);
  }

  const result = (await response.json()) as ApifyRunResponse;
  return result.data.id;
}

/**
 * Busca os resultados do scraping a partir do dataset
 */
export async function getScrapingResults(
  runId: string
): Promise<ApifyDatasetItem | null> {
  // Primeiro, pegar o dataset ID do run
  const runResponse = await fetch(
    `${APIFY_BASE_URL}/actor-runs/${runId}?token=${env.APIFY_TOKEN}`
  );

  if (!runResponse.ok) {
    throw new Error(`Failed to get run info: ${runResponse.status}`);
  }

  const runData = (await runResponse.json()) as {
    data: { defaultDatasetId: string };
  };
  const datasetId = runData.data.defaultDatasetId;

  // Buscar os items do dataset
  const datasetResponse = await fetch(
    `${APIFY_BASE_URL}/datasets/${datasetId}/items?token=${env.APIFY_TOKEN}`
  );

  if (!datasetResponse.ok) {
    throw new Error(`Failed to get dataset items: ${datasetResponse.status}`);
  }

  const items = (await datasetResponse.json()) as ApifyDatasetItem[];

  if (items.length === 0) {
    return null;
  }

  return items[0];
}

/**
 * Converte os dados do Apify para markdown estruturado
 */
export function convertToMarkdown(profile: ApifyDatasetItem): string {
  const lines: string[] = [];

  lines.push(`# ${profile.fullName || 'Unknown'}`);
  lines.push('');

  if (profile.headline) {
    lines.push(`**${profile.headline}**`);
    lines.push('');
  }

  if (profile.location) {
    lines.push(`📍 ${profile.location}`);
    lines.push('');
  }

  if (profile.summary) {
    lines.push('## Sobre');
    lines.push(profile.summary);
    lines.push('');
  }

  if (profile.experience && profile.experience.length > 0) {
    lines.push('## Experiência');
    for (const exp of profile.experience) {
      lines.push(
        `### ${exp.title || 'N/A'} @ ${exp.companyName || 'N/A'}`
      );
      if (exp.dateRange) lines.push(`📅 ${exp.dateRange}`);
      if (exp.location) lines.push(`📍 ${exp.location}`);
      if (exp.description) {
        lines.push('');
        lines.push(exp.description);
      }
      lines.push('');
    }
  }

  if (profile.education && profile.education.length > 0) {
    lines.push('## Educação');
    for (const edu of profile.education) {
      const degree = [edu.degreeName, edu.fieldOfStudy]
        .filter(Boolean)
        .join(' - ');
      lines.push(`### ${edu.schoolName || 'N/A'}`);
      if (degree) lines.push(degree);
      if (edu.dateRange) lines.push(`📅 ${edu.dateRange}`);
      lines.push('');
    }
  }

  if (profile.skills && profile.skills.length > 0) {
    lines.push('## Skills');
    lines.push(profile.skills.join(', '));
    lines.push('');
  }

  return lines.join('\n');
}

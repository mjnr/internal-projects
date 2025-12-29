import { z } from 'zod';

const envSchema = z.object({
  // MongoDB (accepts mongodb:// and mongodb+srv:// URIs)
  MONGODB_URI: z.string().min(1).refine(
    (uri) => uri.startsWith('mongodb://') || uri.startsWith('mongodb+srv://'),
    'Invalid MongoDB URI'
  ),

  // Apify
  APIFY_TOKEN: z.string().min(1),

  // Anthropic
  ANTHROPIC_API_KEY: z.string().min(1),

  // Resend
  RESEND_API_KEY: z.string().min(1),
  RESEND_TEMPLATE_ID: z.string().default('job-candidates-technical-challenge'),
  RESEND_FROM_EMAIL: z.string().email().default('hiring@voidr.co'),

  // Roam
  ROAM_API_KEY: z.string().min(1),
  ROAM_CONVERSION_CHAT_ID: z.string().min(1),

  // Service
  PORT: z.string().default('8080').transform(Number),
  WEBHOOK_BASE_URL: z.string().url(),
  SCORE_THRESHOLD: z.string().default('10').transform(Number),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('❌ Invalid environment variables:');
    console.error(result.error.format());
    process.exit(1);
  }

  return result.data;
}

export const env = loadEnv();

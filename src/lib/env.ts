import { z } from 'zod'

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),

  // NextAuth.js
  NEXTAUTH_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(32),

  // OpenAI
  OPENAI_API_KEY: z.string().startsWith('sk-'),

  // Stripe
  STRIPE_SECRET_KEY: z.string().startsWith('sk_'),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_'),
  STRIPE_PRICE_PRO: z.string().optional(),
  STRIPE_PRICE_TRADER: z.string().optional(),

  // Email
  SENDGRID_API_KEY: z.string().startsWith('SG.').optional(),
  EMAIL_FROM: z.string().email(),

  // SMS
  TWILIO_ACCOUNT_SID: z.string().startsWith('AC').optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_PHONE_NUMBER: z.string().optional(),

  // SEC EDGAR
  SEC_EDGAR_USER_AGENT: z.string(),
  SEC_BASE_URL: z.string().url().default('https://data.sec.gov'),

  // Price APIs
  ALPHA_VANTAGE_API_KEY: z.string().optional(),
  FINNHUB_API_KEY: z.string().optional(),
  PRICE_PROVIDER: z.string().default('alpha'),

  // Optional
  REDIS_URL: z.string().url().optional(),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
})

const clientEnvSchema = z.object({
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().startsWith('pk_'),
})

export const env = envSchema.parse(process.env)
export const clientEnv = clientEnvSchema.parse(process.env)
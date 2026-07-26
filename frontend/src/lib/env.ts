import { z } from 'zod';

const envSchema = z.object({
  GEMINI_API_KEY_PRIMARY: z.string().min(1, 'GEMINI_API_KEY_PRIMARY is required'),
  GEMINI_API_KEY_SECONDARY: z.string().min(1, 'GEMINI_API_KEY_SECONDARY is required'),
  GEMINI_MODEL: z.string().default('gemini-3.6-flash'),
  TAVILY_API_KEY: z.string().min(1, 'TAVILY_API_KEY is required'),
});

export type Env = z.infer<typeof envSchema>;

export function getEnv(): Env {
  return envSchema.parse({
    GEMINI_API_KEY_PRIMARY: process.env.GEMINI_API_KEY_PRIMARY,
    GEMINI_API_KEY_SECONDARY: process.env.GEMINI_API_KEY_SECONDARY,
    GEMINI_MODEL: process.env.GEMINI_MODEL || 'gemini-3.6-flash',
    TAVILY_API_KEY: process.env.TAVILY_API_KEY,
  });
}

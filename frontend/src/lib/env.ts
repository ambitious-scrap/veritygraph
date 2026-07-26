import { z } from 'zod';

const envSchema = z.object({
  OPENROUTER_API_KEY: z.string().min(1, 'OPENROUTER_API_KEY is required'),
  LLM_MODEL: z.string().default('google/gemini-2.5-flash'),
  TAVILY_API_KEY: z.string().min(1, 'TAVILY_API_KEY is required'),
});

export type Env = z.infer<typeof envSchema>;

export function getEnv(): Env {
  return envSchema.parse({
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    LLM_MODEL: process.env.LLM_MODEL || 'google/gemini-2.5-flash',
    TAVILY_API_KEY: process.env.TAVILY_API_KEY,
  });
}

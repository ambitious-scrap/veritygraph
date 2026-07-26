import { NextResponse } from 'next/server';
import { z } from 'zod';
import { runResearchPipeline } from '@/lib/research';

const requestSchema = z.object({
  query: z
    .string({ message: 'Query is required' })
    .transform((val) => val.trim())
    .refine((val) => val.length >= 10, 'Query must be at least 10 characters long')
    .refine((val) => val.length <= 500, 'Query must be at most 500 characters long'),
});

export async function POST(req: Request) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      const errorMessage =
        parsed.error.issues[0]?.message || 'Invalid query parameter';
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    const researchRun = await runResearchPipeline(parsed.data.query);
    return NextResponse.json(researchRun, { status: 200 });
  } catch {
    // Sanitized 500 error response without exposing internal errors or keys
    return NextResponse.json(
      { error: 'Verification pipeline execution failed. Please verify API keys and network connectivity.' },
      { status: 500 }
    );
  }
}

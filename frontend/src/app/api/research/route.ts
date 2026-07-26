import { NextResponse } from 'next/server';
import { z } from 'zod';
import { runResearchPipeline } from '@/lib/research';
import { PipelineError } from '@/lib/types';

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
      return NextResponse.json(
        { error: 'Invalid JSON payload in request body.', stage: 'initial-search' },
        { status: 400 }
      );
    }

    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      const errorMessage =
        parsed.error.issues[0]?.message || 'Invalid query parameter.';
      return NextResponse.json(
        { error: errorMessage, stage: 'initial-search' },
        { status: 400 }
      );
    }

    const { run, usedFallback } = await runResearchPipeline(parsed.data.query);

    return NextResponse.json(run, {
      status: 200,
      headers: {
        'X-Gemini-Fallback-Used': usedFallback ? 'true' : 'false',
      },
    });
  } catch (error) {
    if (error instanceof PipelineError) {
      return NextResponse.json(
        { error: error.safeMessage, stage: error.stage },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        error: 'An unexpected pipeline error occurred during research verification.',
        stage: 'initial-search',
      },
      { status: 500 }
    );
  }
}

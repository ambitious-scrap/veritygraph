import { NextResponse } from 'next/server';
import { z } from 'zod';
import { runResearchPipeline } from '@/lib/research';
import { PipelineError } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store',
};

const requestSchema = z.object({
  mode: z.enum(['research', 'audit']).optional().default('research'),
  query: z.string().optional(),
  text: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON payload in request body.', stage: 'initial-search' },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      const errorMessage =
        parsed.error.issues[0]?.message || 'Invalid request parameters.';
      return NextResponse.json(
        { error: errorMessage, stage: 'initial-search' },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    const mode = parsed.data.mode;
    const inputText = (parsed.data.text || parsed.data.query || '').trim();

    if (mode === 'audit') {
      if (!inputText) {
        return NextResponse.json(
          { error: 'AI answer text is required for Audit Mode.', stage: 'claim-extraction' },
          { status: 400, headers: NO_CACHE_HEADERS }
        );
      }
      if (inputText.length < 100) {
        return NextResponse.json(
          {
            error: 'AI answer text must be at least 100 characters long.',
            stage: 'claim-extraction',
          },
          { status: 400, headers: NO_CACHE_HEADERS }
        );
      }
      if (inputText.length > 6000) {
        return NextResponse.json(
          {
            error: 'AI answer text must be at most 6,000 characters long.',
            stage: 'claim-extraction',
          },
          { status: 400, headers: NO_CACHE_HEADERS }
        );
      }
    } else {
      if (!inputText) {
        return NextResponse.json(
          { error: 'Research query is required.', stage: 'initial-search' },
          { status: 400, headers: NO_CACHE_HEADERS }
        );
      }
      if (inputText.length < 10) {
        return NextResponse.json(
          {
            error: 'Research query must be at least 10 characters long.',
            stage: 'initial-search',
          },
          { status: 400, headers: NO_CACHE_HEADERS }
        );
      }
      if (inputText.length > 500) {
        return NextResponse.json(
          {
            error: 'Research query must be at most 500 characters long.',
            stage: 'initial-search',
          },
          { status: 400, headers: NO_CACHE_HEADERS }
        );
      }
    }

    const { run, usedFallback } = await runResearchPipeline({
      mode,
      query: mode === 'research' ? inputText : undefined,
      text: mode === 'audit' ? inputText : undefined,
    });

    return NextResponse.json(run, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
        'X-Gemini-Fallback-Used': usedFallback ? 'true' : 'false',
      },
    });
  } catch (error) {
    if (error instanceof PipelineError) {
      return NextResponse.json(
        { error: error.safeMessage, stage: error.stage },
        { status: 500, headers: NO_CACHE_HEADERS }
      );
    }

    return NextResponse.json(
      {
        error: 'An unexpected pipeline error occurred during verification.',
        stage: 'initial-search',
      },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}

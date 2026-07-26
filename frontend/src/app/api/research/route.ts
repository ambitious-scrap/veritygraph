import { NextResponse } from 'next/server';
import { z } from 'zod';
import { runResearchPipeline } from '@/lib/research';
import { PipelineError } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const NO_CACHE_HEADERS = { 'Cache-Control': 'no-store' };

const requestSchema = z.union([
  z
    .object({ query: z.string().trim().min(10).max(500) })
    .strict()
    .transform((value) => ({ mode: 'research' as const, query: value.query.trim() })),
  z
    .object({ mode: z.literal('research'), query: z.string().trim().min(10).max(500) })
    .strict()
    .transform((value) => ({ mode: 'research' as const, query: value.query.trim() })),
  z
    .object({ mode: z.literal('audit'), text: z.string().trim().min(100).max(6000) })
    .strict()
    .transform((value) => ({ mode: 'audit' as const, text: value.text.trim() })),
]);

export async function POST(req: Request) {
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
    return NextResponse.json(
      { error: 'Invalid research or audit request.', stage: 'initial-search' },
      { status: 400, headers: NO_CACHE_HEADERS }
    );
  }

  try {
    const { run, usedFallback } = await runResearchPipeline(parsed.data);
    return NextResponse.json(run, {
      status: 200,
      headers: {
        ...NO_CACHE_HEADERS,
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
      { error: 'An unexpected pipeline error occurred during verification.', stage: 'initial-search' },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { reverifyClaim } from '@/lib/research';
import { PipelineError } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 45;
export const dynamic = 'force-dynamic';

const NO_CACHE_HEADERS = { 'Cache-Control': 'no-store' };

const requestSchema = z
  .object({
    claimId: z.string().trim().min(1).max(100),
    claimText: z.string().trim().min(10).max(500),
    supportQuery: z.string().trim().min(3).max(300),
    challengeQuery: z.string().trim().min(3).max(300),
    nextBestQuery: z.string().trim().min(3).max(300),
  })
  .strict();

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON payload in request body.', stage: 'reverification' },
      { status: 400, headers: NO_CACHE_HEADERS }
    );
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid claim re-verification request.', stage: 'reverification' },
      { status: 400, headers: NO_CACHE_HEADERS }
    );
  }

  try {
    const result = await reverifyClaim(parsed.data);
    return NextResponse.json(
      {
        claim: result.claim,
        providerMetadata: { fallbackUsed: result.usedFallback },
        trace: result.trace,
        manifestPatch: result.manifestPatch,
      },
      {
        status: 200,
        headers: {
          ...NO_CACHE_HEADERS,
          'X-Gemini-Fallback-Used': result.usedFallback ? 'true' : 'false',
        },
      }
    );
  } catch (error) {
    if (error instanceof PipelineError) {
      return NextResponse.json(
        { error: error.safeMessage, stage: error.stage },
        { status: 500, headers: NO_CACHE_HEADERS }
      );
    }
    return NextResponse.json(
      { error: 'An unexpected claim re-verification error occurred.', stage: 'reverification' },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}

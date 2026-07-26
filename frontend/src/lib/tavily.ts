import { z } from 'zod';

const FETCH_TIMEOUT_MS = 15000;

export interface RawSource {
  id: string;
  title: string;
  url: string;
  domain: string;
  excerpt: string;
}

export interface CandidateEvidence extends RawSource {
  candidateType: 'support-candidate' | 'challenge-candidate';
}

const tavilyResultSchema = z.object({
  title: z.string().optional().default('Untitled Source'),
  url: z.string().url(),
  content: z.string().optional().default(''),
});

const tavilyResponseSchema = z.object({
  results: z.array(tavilyResultSchema).optional().default([]),
});

export async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs = FETCH_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return res;
  } finally {
    clearTimeout(timeoutId);
  }
}

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    return parsed.toString().replace(/\/$/, '').toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}

function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return 'external';
  }
}

/**
 * Stage 1: Initial Research Tavily Search
 */
export async function searchInitialSources(
  query: string,
  apiKey: string
): Promise<RawSource[]> {
  try {
    const res = await fetchWithTimeout('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: 'advanced',
        max_results: 5,
        include_answer: false,
        include_raw_content: false,
      }),
    });

    if (!res.ok) {
      return [];
    }

    const data = await res.json();
    const parsed = tavilyResponseSchema.safeParse(data);
    if (!parsed.success) {
      return [];
    }

    const rawList = parsed.data.results;
    const seen = new Set<string>();
    const sources: RawSource[] = [];

    let count = 1;
    for (const item of rawList) {
      const canonical = normalizeUrl(item.url);
      if (seen.has(canonical)) continue;
      seen.add(canonical);

      sources.push({
        id: `src-${count++}`,
        title: item.title,
        url: item.url,
        domain: extractDomain(item.url),
        excerpt: item.content || item.title,
      });
    }

    return sources;
  } catch {
    return [];
  }
}

/**
 * Stage 3: Evidence Search for a single claim
 */
export async function searchClaimEvidence(
  supportQuery: string,
  challengeQuery: string,
  apiKey: string,
  claimIndex: number
): Promise<CandidateEvidence[]> {
  const fetchQuery = async (
    q: string,
    candidateType: 'support-candidate' | 'challenge-candidate'
  ): Promise<CandidateEvidence[]> => {
    if (!q.trim()) return [];
    try {
      const res = await fetchWithTimeout('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey,
          query: q,
          search_depth: 'basic',
          max_results: 3,
          include_answer: false,
          include_raw_content: false,
        }),
      });

      if (!res.ok) return [];

      const data = await res.json();
      const parsed = tavilyResponseSchema.safeParse(data);
      if (!parsed.success) return [];

      let idx = 1;
      return parsed.data.results.map((item) => ({
        id: `c${claimIndex}-ev-${candidateType === 'support-candidate' ? 's' : 'c'}-${idx++}`,
        title: item.title,
        url: item.url,
        domain: extractDomain(item.url),
        excerpt: item.content || item.title,
        candidateType,
      }));
    } catch {
      return [];
    }
  };

  const [supportResults, challengeResults] = await Promise.all([
    fetchQuery(supportQuery, 'support-candidate'),
    fetchQuery(challengeQuery, 'challenge-candidate'),
  ]);

  const combined = [...supportResults, ...challengeResults];
  const seen = new Set<string>();
  const deduplicated: CandidateEvidence[] = [];

  for (const item of combined) {
    const canonical = normalizeUrl(item.url);
    if (seen.has(canonical)) continue;
    seen.add(canonical);
    deduplicated.push(item);
  }

  return deduplicated;
}

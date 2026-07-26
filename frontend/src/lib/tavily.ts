import { z } from 'zod';
import { EvidenceBasis, PipelineError } from './types';

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
  evidenceBasis: EvidenceBasis;
  extractedText?: string;
}

const tavilyResultSchema = z.object({
  title: z.string().optional().default('Untitled Source'),
  url: z.string().url(),
  content: z.string().optional().default(''),
});

const tavilyResponseSchema = z.object({
  results: z.array(tavilyResultSchema).optional().default([]),
});

const tavilyExtractResultSchema = z.object({
  url: z.string(),
  raw_content: z.string().optional().default(''),
});

const tavilyExtractResponseSchema = z.object({
  results: z.array(tavilyExtractResultSchema).optional().default([]),
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
  let res: Response;
  try {
    res = await fetchWithTimeout('https://api.tavily.com/search', {
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
  } catch {
    throw new PipelineError(
      'initial-search',
      'Failed to connect to search provider during initial literature search.'
    );
  }

  if (!res.ok) {
    throw new PipelineError(
      'initial-search',
      `Search provider returned error status (${res.status}) during initial research.`
    );
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new PipelineError(
      'initial-search',
      'Failed to parse search provider response during initial research.'
    );
  }

  const parsed = tavilyResponseSchema.safeParse(data);
  if (!parsed.success) {
    throw new PipelineError(
      'initial-search',
      'Search provider returned malformed response schema during initial research.'
    );
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

    let res: Response;
    try {
      res = await fetchWithTimeout('https://api.tavily.com/search', {
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
    } catch {
      throw new PipelineError(
        'evidence-search',
        `Failed to connect to search provider while searching evidence for claim ${claimIndex}.`
      );
    }

    if (!res.ok) {
      throw new PipelineError(
        'evidence-search',
        `Search provider returned error (${res.status}) while retrieving evidence for claim ${claimIndex}.`
      );
    }

    let data: unknown;
    try {
      data = await res.json();
    } catch {
      throw new PipelineError(
        'evidence-search',
        `Failed to parse evidence search response for claim ${claimIndex}.`
      );
    }

    const parsed = tavilyResponseSchema.safeParse(data);
    if (!parsed.success) {
      throw new PipelineError(
        'evidence-search',
        `Search provider returned malformed evidence schema for claim ${claimIndex}.`
      );
    }

    let idx = 1;
    return parsed.data.results.map((item) => ({
      id: `c${claimIndex}-ev-${candidateType === 'support-candidate' ? 's' : 'c'}-${idx++}`,
      title: item.title,
      url: item.url,
      domain: extractDomain(item.url),
      excerpt: item.content || item.title,
      candidateType,
      evidenceBasis: 'search-snippet',
    }));
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

/**
 * Helper to select up to 4 candidate URLs per claim (max 2 support, max 2 challenge, prefer distinct domains)
 */
function selectTargetExtractionCandidates(
  candidates: CandidateEvidence[]
): CandidateEvidence[] {
  const selectUpToTwo = (list: CandidateEvidence[]): CandidateEvidence[] => {
    if (list.length <= 2) return list;

    // Prefer distinct domains
    const result: CandidateEvidence[] = [];
    const seenDomains = new Set<string>();

    // First pass: distinct domains
    for (const c of list) {
      if (!seenDomains.has(c.domain)) {
        seenDomains.add(c.domain);
        result.push(c);
        if (result.length === 2) break;
      }
    }

    // Second pass: fill if < 2
    if (result.length < 2) {
      for (const c of list) {
        if (!result.includes(c)) {
          result.push(c);
          if (result.length === 2) break;
        }
      }
    }

    return result;
  };

  const supportList = candidates.filter(
    (c) => c.candidateType === 'support-candidate'
  );
  const challengeList = candidates.filter(
    (c) => c.candidateType === 'challenge-candidate'
  );

  const selectedSupport = selectUpToTwo(supportList);
  const selectedChallenge = selectUpToTwo(challengeList);

  return [...selectedSupport, ...selectedChallenge];
}

/**
 * Stage 4: Focused Evidence Extraction via Tavily Extract (with graceful fallback to search snippets)
 */
export async function extractFocusedEvidence(
  claimText: string,
  candidates: CandidateEvidence[],
  apiKey: string
): Promise<CandidateEvidence[]> {
  const selectedCandidates = selectTargetExtractionCandidates(candidates);
  const selectedUrls = selectedCandidates.map((c) => c.url);

  // If no URLs selected, return original candidates with snippet basis
  if (selectedUrls.length === 0) {
    return candidates.map((c) => ({
      ...c,
      evidenceBasis: 'search-snippet',
    }));
  }

  // Execute Tavily Extract with 15s timeout
  const extractMap = new Map<string, string>(); // canonicalUrl -> extractedText

  try {
    const res = await fetchWithTimeout('https://api.tavily.com/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        urls: selectedUrls,
        query: claimText,
        chunks_per_source: 2,
        extract_depth: 'basic',
        format: 'text',
        timeout: 15,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const parsed = tavilyExtractResponseSchema.safeParse(data);
      if (parsed.success) {
        for (const item of parsed.data.results) {
          const rawText = item.raw_content || '';
          const normalized = rawText.replace(/\s+/g, ' ').trim();
          if (normalized.length > 0) {
            extractMap.set(normalizeUrl(item.url), normalized.slice(0, 1500));
          }
        }
      }
    }
  } catch {
    // Graceful Fallback: Extraction failures MUST NOT terminate the pipeline.
    // Continue using search snippets seamlessly.
  }

  // Update candidate evidence objects
  return candidates.map((c) => {
    const canonical = normalizeUrl(c.url);
    const extracted = extractMap.get(canonical);

    if (extracted) {
      return {
        ...c,
        excerpt: extracted,
        extractedText: extracted,
        evidenceBasis: 'full-source-extract',
      };
    }

    return {
      ...c,
      evidenceBasis: 'search-snippet',
    };
  });
}

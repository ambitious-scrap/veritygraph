'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  HelpCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Search,
  RefreshCw,
  FileText,
  AlertCircle,
  Database,
  Info,
  Globe,
  Clock,
  Layers,
  FileCode,
  Download,
  ArrowRight,
  Copy,
  Check,
  Cpu,
  Minus,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
} from 'lucide-react';
import { DEMO_SCENARIOS } from '@/lib/mockData';
import {
  Claim,
  ClaimVerdict,
  EvidenceBasis,
  EvidenceStance,
  ResearchRun,
  VerificationBuildStatus,
  WorkflowMode,
} from '@/lib/types';
import { calculateOverallBuildResult } from '@/lib/verificationRules';

const STAGES = [
  'Searching sources',
  'Extracting claims',
  'Challenging claims',
  'Reading source pages',
  'Verifying evidence',
  'Compiling report',
];

function confColor(pct: number) {
  if (pct >= 80) return 'var(--ok)';
  if (pct >= 60) return 'var(--warn)';
  if (pct >= 40) return 'var(--accent)';
  return 'var(--bad)';
}

function pct(v: number) {
  return Math.round(v > 1 ? v : v * 100);
}

function summaryPoints(summary: string) {
  const points = summary
    .split(/(?<=[.!?])\s+/)
    .map((point) => point.trim())
    .filter(Boolean)
    .slice(0, 3);
  return points.length ? points : [summary.trim()];
}

function claimDigestText(claim: Claim) {
  return claim.explanation.replace(/\s+/g, ' ').trim();
}

const verdictCfg: Record<ClaimVerdict, { bg: string; fg: string; icon: React.ReactNode; label: string }> = {
  supported:    { bg: 'var(--ok-dim)',   fg: 'var(--ok-text)',   icon: <CheckCircle2 className="w-3 h-3" />, label: 'Supported' },
  contradicted: { bg: 'var(--bad-dim)',  fg: 'var(--bad-text)',  icon: <XCircle className="w-3 h-3" />,      label: 'Contradicted' },
  partial:      { bg: 'var(--warn-dim)', fg: 'var(--warn-text)', icon: <AlertTriangle className="w-3 h-3" />, label: 'Partial' },
  insufficient: { bg: 'var(--mute-dim)', fg: 'var(--mute-text)', icon: <HelpCircle className="w-3 h-3" />,   label: 'Insufficient' },
};

function Badge({ v }: { v: ClaimVerdict }) {
  const c = verdictCfg[v];
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold"
          style={{ background: c.bg, color: c.fg }}>
      {c.icon} {c.label}
    </span>
  );
}

function StanceBadge({ s }: { s: EvidenceStance }) {
  const map: Record<EvidenceStance, { bg: string; fg: string; icon: React.ReactNode; label: string }> = {
    support:    { bg: 'var(--ok-dim)',   fg: 'var(--ok-text)',   icon: <CheckCircle2 className="w-3 h-3" />, label: 'Supports' },
    contradict: { bg: 'var(--bad-dim)',  fg: 'var(--bad-text)',  icon: <XCircle className="w-3 h-3" />,      label: 'Challenges' },
    neutral:    { bg: 'var(--mute-dim)', fg: 'var(--mute-text)', icon: <Minus className="w-3 h-3" />,        label: 'Context' },
  };
  const c = map[s];
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold"
          style={{ background: c.bg, color: c.fg }}>
      {c.icon} {c.label}
    </span>
  );
}

function BasisBadge({ b }: { b: EvidenceBasis }) {
  const extracted = b === 'focused-source-extract';
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
          style={{
            background: extracted ? 'var(--info-dim)' : 'var(--bg-overlay)',
            color: extracted ? 'var(--info-text)' : 'var(--ink-3)',
          }}>
      {extracted ? <FileText className="w-3 h-3" /> : <FileCode className="w-3 h-3" />}
      {extracted ? 'Extracted' : 'Snippet'}
    </span>
  );
}

function BuildBadge({ s }: { s: VerificationBuildStatus }) {
  const map: Record<VerificationBuildStatus, { bg: string; fg: string; icon: React.ReactNode; label: string }> = {
    pass: { bg: 'var(--ok-dim)', fg: 'var(--ok-text)', icon: <Check className="w-3 h-3" />, label: 'PASS' },
    warning: { bg: 'var(--warn-dim)', fg: 'var(--warn-text)', icon: <AlertTriangle className="w-3 h-3" />, label: 'WARNING' },
    fail: { bg: 'var(--bad-dim)', fg: 'var(--bad-text)', icon: <XCircle className="w-3 h-3" />, label: 'FAIL' },
  };
  const c = map[s];
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold"
          style={{ background: c.bg, color: c.fg }}>
      {c.icon} {c.label}
    </span>
  );
}

export default function Home() {
  const [selectedMode, setSelectedMode] = useState<WorkflowMode>('research');
  const [query, setQuery] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [stageIndex, setStageIndex] = useState(0);
  const [error, setError] = useState<{ message: string; stage?: string } | null>(null);
  const [run, setRun] = useState<ResearchRun | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [whyOpen, setWhyOpen] = useState<Record<string, boolean>>({});
  const [reverifying, setReverifying] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [demoIndex, setDemoIndex] = useState(0);
  const [isDemoCycling, setIsDemoCycling] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const applyDemo = useCallback((index: number) => {
    const normalizedIndex = (index + DEMO_SCENARIOS.length) % DEMO_SCENARIOS.length;
    const scenario = DEMO_SCENARIOS[normalizedIndex];
    setDemoIndex(normalizedIndex);
    setSelectedMode(scenario.mode);
    setQuery(scenario.run.query);
    setError(null);
    setRun({ ...scenario.run, createdAt: new Date().toISOString() });
    setOpen({});
    setWhyOpen({});
  }, []);

  useEffect(() => {
    if (!isDemoCycling) return;
    const timer = window.setTimeout(() => applyDemo(demoIndex + 1), 6500);
    return () => window.clearTimeout(timer);
  }, [applyDemo, demoIndex, isDemoCycling]);

  useEffect(() => {
    if (!isAnalyzing) return;
    const id = setInterval(() => setStageIndex((p) => (p + 1) % STAGES.length), 2000);
    return () => clearInterval(id);
  }, [isAnalyzing]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = query.trim();
    if (!t) return;
    if (selectedMode === 'audit') {
      if (t.length < 100) { setError({ message: 'Audit text must be at least 100 characters.', stage: 'input' }); return; }
      if (t.length > 6000) { setError({ message: 'Audit text must be at most 6,000 characters.', stage: 'input' }); return; }
    } else {
      if (t.length < 10) { setError({ message: 'Query must be at least 10 characters.', stage: 'input' }); return; }
      if (t.length > 500) { setError({ message: 'Query must be at most 500 characters.', stage: 'input' }); return; }
    }
    setIsAnalyzing(true); setStageIndex(0); setError(null); setIsDemoCycling(false);
    try {
      const res = await fetch('/api/research', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selectedMode === 'audit' ? { mode: 'audit', text: t } : { mode: 'research', query: t }),
      });
      const data = await res.json();
      if (!res.ok) { setError({ message: data.error || 'Pipeline failed.', stage: data.stage || 'pipeline' }); }
      else {
        setRun(data as ResearchRun);
        setOpen({});
        setWhyOpen({});
      }
    } catch { setError({ message: 'Network error.', stage: 'connection' }); }
    finally { setIsAnalyzing(false); }
  };

  const loadExample = () => {
    setIsDemoCycling(false);
    setSelectedMode('research');
    setQuery('Does coffee consumption decrease overall mortality and cardiovascular disease risk?');
    setError(null);
    inputRef.current?.focus();
  };

  const loadDemo = () => applyDemo(demoIndex);
  const previousDemo = () => applyDemo(demoIndex - 1);
  const nextDemo = () => applyDemo(demoIndex + 1);

  const toggle = (id: string) => setOpen((p) => ({ ...p, [id]: !p[id] }));
  const toggleWhy = (id: string) => setWhyOpen((p) => ({ ...p, [id]: !p[id] }));

  const copyNextQuery = (claimId: string, nextBestQuery: string) => {
    void navigator.clipboard.writeText(nextBestQuery);
    setCopied(claimId);
    setTimeout(() => setCopied(null), 1600);
  };

  const reverifyClaim = async (claim: Claim) => {
    if (reverifying[claim.id]) return;
    setReverifying((current) => ({ ...current, [claim.id]: true }));
    setError(null);
    try {
      const response = await fetch('/api/reverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claimId: claim.id,
          claimText: claim.text,
          supportQuery: claim.searchQueries.support,
          challengeQuery: claim.searchQueries.challenge,
          nextBestQuery: claim.nextBestQuery,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError({ message: data.error || 'Claim re-verification failed.', stage: data.stage || 'reverification' });
        return;
      }
      const result = data as {
        claim: Claim;
        providerMetadata: { fallbackUsed: boolean };
        trace: ResearchRun['agentTrace'];
        manifestPatch: { generatedAt: string; evidenceCount: number; focusedExtractCount: number; snippetFallbackCount: number };
      };
      setRun((current) => {
        if (!current) return current;
        const claims = current.claims.map((item) => item.id === result.claim.id ? { ...result.claim, sourceQuote: item.sourceQuote, auditAnchor: item.auditAnchor } : item);
        const evidence = claims.reduce((count, item) => count + item.evidence.length, 0);
        const focused = claims.reduce((count, item) => count + item.evidence.filter((item) => item.evidenceBasis === 'focused-source-extract').length, 0);
        const snippets = evidence - focused;
        const reverifyDuration = result.trace.reduce((total, step) => total + step.durationMs, 0);
        return {
          ...current,
          claims,
          buildResult: calculateOverallBuildResult(claims),
          providerMetadata: {
            fallbackUsed: current.providerMetadata.fallbackUsed || result.providerMetadata.fallbackUsed,
          },
          agentTrace: [...current.agentTrace, ...result.trace],
          manifest: {
            ...current.manifest,
            generatedAt: result.manifestPatch.generatedAt,
            fallbackUsed: current.manifest.fallbackUsed || result.providerMetadata.fallbackUsed,
            retainedEvidenceCount: evidence,
            focusedExtractCount: focused,
            snippetFallbackCount: snippets,
            stageDurationsMs: {
              ...current.manifest.stageDurationsMs,
              reverification: reverifyDuration,
            },
          },
          summaryMetadata: {
            ...current.summaryMetadata,
            stale: true,
            staleReason: 'One or more claims were re-verified after this summary was generated.',
          },
        };
      });
    } catch {
      setError({ message: 'Network error during claim re-verification.', stage: 'reverification' });
    } finally {
      setReverifying((current) => ({ ...current, [claim.id]: false }));
    }
  };

  const exportReport = (format: 'md' | 'json') => {
    if (!run) return;
    const disclaimer = 'This report records retrieved evidence and automated verification decisions. Confidence scores and source-independence groups are heuristic and do not represent certainty or replace expert review.';
    if (format === 'json') {
      const blob = new Blob([JSON.stringify({ reportType: 'VerityGraph Proof-Carrying Report', disclaimer, ...run }, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'veritygraph-proof-report.json'; a.click();
      URL.revokeObjectURL(url);
      return;
    }

    const trace = run.agentTrace
      .map((step) => `- ${step.role}: ${step.label} — ${step.status}; ${step.durationMs}ms; ${step.note}`)
      .join('\n');
    const claims = run.claims.map((claim, index) => {
      const evidenceByStance = (stance: EvidenceStance) => claim.evidence
        .filter((evidence) => evidence.stance === stance)
        .map((evidence) => `- [${evidence.title}](${evidence.url}) — ${evidence.domain}; ${evidence.evidenceBasis}; ${evidence.originGroupId}\n  > ${evidence.excerpt}`)
        .join('\n') || '- None retained.';
      return [
        `## Claim ${index + 1}: ${claim.text}`,
        `- Claim build status: ${claim.claimBuildStatus}`,
        `- Verdict: ${claim.verdict}`,
        `- Confidence: ${pct(claim.confidence)}%`,
        `- Confidence factors: evidence=${claim.confidenceFactors.evidenceCount}; domains=${claim.confidenceFactors.distinctDomains}; contradiction=${claim.confidenceFactors.hasContradiction}; cap=${claim.confidenceFactors.appliedCap || 'none'}`,
        `- Source independence: ${claim.sourceIndependence.independentOrigins}/${claim.sourceIndependence.sourceCount} independent origins; duplicate groups=${claim.sourceIndependence.duplicateGroups}; syndicated sources=${claim.sourceIndependence.syndicatedSourceCount}`,
        `- Missing evidence: ${claim.missingEvidence}`,
        `- Recommended next query: ${claim.nextBestQuery}`,
        `- Support search query: ${claim.searchQueries.support}`,
        `- Challenge search query: ${claim.searchQueries.challenge}`,
        claim.auditAnchor ? `- Audit source quote: ${claim.auditAnchor.quote}\n- Audit quote match: ${claim.auditAnchor.matchStatus} (${claim.auditAnchor.startIndex ?? 'n/a'}–${claim.auditAnchor.endIndex ?? 'n/a'})` : '- Audit source quote: not applicable.',
        '',
        '### Support evidence',
        evidenceByStance('support'),
        '',
        '### Contradicting evidence',
        evidenceByStance('contradict'),
        '',
        '### Neutral evidence',
        evidenceByStance('neutral'),
      ].join('\n');
    }).join('\n\n');

    const md = [
      '# VerityGraph Proof-Carrying Report',
      '',
      `- Workflow mode: ${run.workflowMode}`,
      `- Original question or audited answer: ${run.query}`,
      `- Build result: ${run.buildResult.status} — ${run.buildResult.headline}`,
      `- Created: ${run.createdAt}`,
      '',
      '## Executive summary',
      run.summary,
      '',
      '## Stale-summary disclosure',
      run.summaryMetadata.stale ? `STALE: ${run.summaryMetadata.staleReason}` : 'Current: this summary was generated with the claims in this report.',
      '',
      '## Agent execution trace',
      trace,
      '',
      '## Reproducibility manifest',
      '```json',
      JSON.stringify(run.manifest, null, 2),
      '```',
      '',
      claims,
      '',
      `Disclaimer: ${disclaimer}`,
      '',
    ].join('\n');
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'veritygraph-proof-report.md'; a.click();
    URL.revokeObjectURL(url);
  };


  const total = run?.claims.length || 0;
  const counts = {
    ok:   run?.claims.filter((c) => c.verdict === 'supported').length || 0,
    bad:  run?.claims.filter((c) => c.verdict === 'contradicted').length || 0,
    warn: run?.claims.filter((c) => c.verdict === 'partial').length || 0,
    mute: run?.claims.filter((c) => c.verdict === 'insufficient').length || 0,
  };
  const avgConf = total
    ? Math.round(run!.claims.reduce((a, c) => a + pct(c.confidence), 0) / total)
    : 0;

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden" style={{ background: 'var(--bg)' }}>
      <header className="sticky top-0 z-20 backdrop-blur-md"
              style={{ background: 'oklch(0.14 0.008 260 / 0.86)', borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-4 h-4" style={{ color: 'var(--accent)' }} aria-hidden="true" />
            <span className="text-sm font-bold tracking-tight" style={{ color: 'var(--ink)' }}>
              VerityGraph
            </span>
            <span className="hidden sm:inline-flex text-[10px] font-mono px-2 py-0.5 rounded"
                  style={{ color: 'var(--ink-3)', background: 'var(--bg-overlay)' }}>
              evidence workspace
            </span>
          </div>
          <span className="text-[10px] font-mono" style={{ color: 'var(--ink-3)' }}>
            claim-level verification
          </span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10 flex-1 w-full">
        <section aria-labelledby="landing-title" className="max-w-5xl mx-auto text-center mb-14 anim-in">
          <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 mb-5"
               style={{ color: 'var(--accent-text)', background: 'var(--accent-dim)', border: '1px solid oklch(0.34 0.08 30)' }}>
            <Cpu className="w-3.5 h-3.5" />
            <span className="text-[11px] font-bold">Evidence checker for research and AI answers</span>
          </div>
          <h1 id="landing-title" className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[0.96] max-w-4xl mx-auto"
              style={{ color: 'var(--ink)', letterSpacing: '-0.06em' }}>
            Make every claim carry its evidence.
          </h1>
          <p className="text-base sm:text-lg leading-relaxed mt-5 max-w-2xl mx-auto" style={{ color: 'var(--ink-2)' }}>
            Turn a research query or AI answer into a clear evidence trail you can inspect, challenge, and share.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2.5 mt-7">
            <button type="button"
              onClick={() => { inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); inputRef.current?.focus(); }}
              className="inline-flex min-h-11 items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg tr"
              style={{ background: 'var(--accent)', color: '#fff' }}>
              Start verifying <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button type="button" onClick={() => { loadDemo(); setIsDemoCycling(true); }}
              className="inline-flex min-h-11 items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg tr"
              style={{ background: 'var(--bg-raised)', color: 'var(--ink-2)', border: '1px solid var(--border)' }}>
              <Database className="w-3.5 h-3.5" /> See a demo
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-10 text-left">
            {[
              ['Understand the claim', 'Break broad answers into checkable statements.'],
              ['See the evidence', 'Compare supporting and challenging source passages.'],
              ['Know what to do next', 'Find the missing proof and the next best query.'],
            ].map(([title, body]) => (
              <div key={title} className="rounded-xl p-4" style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)' }}>
                <span className="text-xs font-bold block" style={{ color: 'var(--ink)' }}>{title}</span>
                <span className="text-[11px] leading-relaxed block mt-1.5" style={{ color: 'var(--ink-3)' }}>{body}</span>
              </div>
            ))}
          </div>
        </section>

        <section id="verification-workspace" aria-labelledby="workspace-title" className="max-w-3xl mx-auto mb-8">
          <div className="flex items-end justify-between gap-4 mb-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--accent-text)', letterSpacing: '0.1em' }}>
                Verification workspace
              </p>
              <h2 id="workspace-title" className="text-2xl sm:text-3xl font-bold tracking-tight mt-1" style={{ color: 'var(--ink)' }}>
                Run a verification
              </h2>
              <p className="text-sm mt-2" style={{ color: 'var(--ink-2)' }}>
                Start with a research question or paste an AI answer. We will show the result first, then the proof behind it.
              </p>
            </div>
            {run ? <BuildBadge s={run.buildResult.status} /> : (
              <span className="hidden sm:inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-semibold" style={{ color: 'var(--accent-text)', background: 'var(--accent-dim)' }}>
                <ShieldCheck className="w-3 h-3" /> Ready
              </span>
            )}
          </div>

          <div className="rounded-2xl p-4 sm:p-5 shadow-2xl" style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
            <div className="flex gap-2 mb-3" role="tablist" aria-label="Workflow mode">
              <button type="button" role="tab" onClick={() => setSelectedMode('research')} aria-selected={selectedMode === 'research'}
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-bold rounded-md tr"
                style={{ background: selectedMode === 'research' ? 'var(--accent-dim)' : 'var(--bg-overlay)', color: selectedMode === 'research' ? 'var(--accent-text)' : 'var(--ink-2)', border: '1px solid var(--border-subtle)' }}>
                <Search className="w-3 h-3" /> Research
              </button>
              <button type="button" role="tab" onClick={() => setSelectedMode('audit')} aria-selected={selectedMode === 'audit'}
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-bold rounded-md tr"
                style={{ background: selectedMode === 'audit' ? 'var(--accent-dim)' : 'var(--bg-overlay)', color: selectedMode === 'audit' ? 'var(--accent-text)' : 'var(--ink-2)', border: '1px solid var(--border-subtle)' }}>
                <Cpu className="w-3 h-3" /> Audit
              </button>
            </div>

            <form onSubmit={handleVerify} className="space-y-3">
              <label htmlFor="research-query" className="block text-xs font-semibold" style={{ color: 'var(--ink)' }}>
                {selectedMode === 'audit' ? 'AI answer or report' : 'Research claim or question'}
              </label>
              <textarea
                ref={inputRef}
                id="research-query"
                rows={selectedMode === 'audit' ? 5 : 4}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                disabled={isAnalyzing}
                placeholder={selectedMode === 'audit' ? 'Paste the answer or report you want to check...' : 'Enter a claim or question to verify...'}
                className="w-full h-32 rounded-lg px-4 py-3 text-sm resize-none overflow-y-auto tr disabled:opacity-40"
                style={{ background: 'var(--bg-inset)', color: 'var(--ink)', border: '1px solid var(--border)' }}
              />
              <div className="flex flex-wrap gap-2">
                <button type="submit" disabled={isAnalyzing || !query.trim()}
                  className="inline-flex min-h-11 items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg disabled:opacity-30 tr"
                  style={{ background: 'var(--accent)', color: '#fff' }}
                  onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.background = 'var(--accent-hover)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--accent)'; }}>
                  {isAnalyzing ? (
                    <span className="inline-flex items-center gap-2" aria-live="polite">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span className="text-xs">{STAGES[stageIndex]}</span>
                    </span>
                  ) : (
                    <>{selectedMode === 'audit' ? <Cpu className="w-3.5 h-3.5" /> : <Search className="w-3.5 h-3.5" />} {selectedMode === 'audit' ? 'Audit answer' : 'Verify research'}</>
                  )}
                </button>
                <button type="button" onClick={loadExample} disabled={isAnalyzing}
                  className="inline-flex min-h-11 items-center gap-1 px-3 py-2 text-[11px] font-medium rounded-md disabled:opacity-30 tr"
                  style={{ background: 'var(--bg-overlay)', color: 'var(--ink-2)', border: '1px solid var(--border-subtle)' }}>
                  <RefreshCw className="w-3 h-3" /> Use example
                </button>
                <button type="button" onClick={loadDemo} disabled={isAnalyzing}
                  className="inline-flex min-h-11 items-center gap-1 px-3 py-2 text-[11px] font-medium rounded-md disabled:opacity-30 tr"
                  style={{ background: 'var(--bg-overlay)', color: 'var(--ink-2)', border: '1px solid var(--border-subtle)' }}>
                  <Database className="w-3 h-3" /> Load demo
                </button>
              </div>
              <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--ink-3)' }}>
                      Demo carousel
                    </span>
                    <span className="text-[10px] font-mono" style={{ color: 'var(--accent-text)' }}>
                      {demoIndex + 1}/{DEMO_SCENARIOS.length}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button type="button" onClick={() => { setIsDemoCycling(false); previousDemo(); }} aria-label="Previous demo"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md tr"
                      style={{ color: 'var(--ink-2)', background: 'var(--bg-overlay)', border: '1px solid var(--border-subtle)' }}>
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" onClick={() => { setIsDemoCycling(false); nextDemo(); }} aria-label="Next demo"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md tr"
                      style={{ color: 'var(--ink-2)', background: 'var(--bg-overlay)', border: '1px solid var(--border-subtle)' }}>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" onClick={() => setIsDemoCycling((current) => !current)}
                      className="inline-flex min-h-8 items-center gap-1.5 px-2.5 rounded-md text-[10px] font-semibold tr"
                      style={{ color: isDemoCycling ? 'var(--accent-text)' : 'var(--ink-2)', background: isDemoCycling ? 'var(--accent-dim)' : 'var(--bg-overlay)', border: '1px solid var(--border-subtle)' }}>
                      {isDemoCycling ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                      {isDemoCycling ? 'Pause cycle' : 'Cycle demos'}
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {DEMO_SCENARIOS.map((scenario, index) => (
                    <button key={scenario.id} type="button" onClick={() => { setIsDemoCycling(false); applyDemo(index); }}
                      aria-pressed={demoIndex === index}
                      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[10px] font-semibold tr"
                      style={{
                        color: demoIndex === index ? 'var(--accent-text)' : 'var(--ink-3)',
                        background: demoIndex === index ? 'var(--accent-dim)' : 'var(--bg-overlay)',
                        border: `1px solid ${demoIndex === index ? 'var(--focus)' : 'var(--border-subtle)'}`,
                      }}>
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: demoIndex === index ? 'var(--accent)' : 'var(--ink-3)' }} />
                      {scenario.label}
                    </button>
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <div className="flex flex-1 gap-1" aria-hidden="true">
                    {DEMO_SCENARIOS.map((scenario, index) => (
                      <span key={scenario.id} className={`h-1 flex-1 rounded-full ${isDemoCycling && demoIndex === index ? 'demo-cycle-progress' : ''}`}
                        style={{ background: demoIndex === index ? 'var(--accent)' : 'var(--border)' }} />
                    ))}
                  </div>
                  <span className="text-[10px] truncate max-w-[18rem]" style={{ color: 'var(--ink-3)' }}>
                    {DEMO_SCENARIOS[demoIndex].description}
                  </span>
                </div>
              </div>
            </form>
          </div>
        </section>

        {error && (
          <div role="alert" className="mb-6 rounded-lg p-3 flex items-start gap-2.5 text-sm anim-in"
               style={{ background: 'var(--bad-dim)', border: '1px solid oklch(0.30 0.06 20)', color: 'var(--bad-text)' }}>
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider font-mono px-1 py-0.5 rounded mr-2"
                    style={{ background: 'oklch(0.30 0.06 20)' }}>
                {error.stage}
              </span>
              <span className="text-xs">{error.message}</span>
            </div>
          </div>
        )}

        <section className="grid grid-cols-3 sm:grid-cols-6 gap-2.5 mb-6 stagger">
          {STAGES.map((step, i) => (
            <div key={step} className="rounded-lg px-3 py-2.5 anim-in" style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)' }}>
              <span className="text-[10px] font-mono font-bold block mb-0.5" style={{ color: stageIndex === i && isAnalyzing ? 'var(--accent-text)' : 'var(--ink-3)' }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="text-xs font-semibold" style={{ color: 'var(--ink-2)' }}>{step.replace(' sources', '').replace(' pages', '')}</span>
            </div>
          ))}
        </section>


        {run && (
          <div key={run.id} className="space-y-6 anim-in demo-run">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg p-3"
                 style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)' }}>
              <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--ink-3)' }}>
                {run.workflowMode === 'audit' ? 'AI answer audit' : 'Research verification'}
              </span>
              {run.mode === 'demo' && (
                <span className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold"
                  style={{ color: 'var(--accent-text)', background: 'var(--accent-dim)', border: '1px solid var(--focus)' }}>
                  <Database className="w-3 h-3" /> Demo {demoIndex + 1}/{DEMO_SCENARIOS.length}
                </span>
              )}
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => exportReport('md')}
                  className="inline-flex min-h-11 items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold rounded-md tr"
                  style={{ background: 'var(--bg-overlay)', color: 'var(--ink-2)', border: '1px solid var(--border-subtle)' }}>
                  <Download className="w-3 h-3" /> Download Markdown
                </button>
                <button type="button" onClick={() => exportReport('json')}
                  className="inline-flex min-h-11 items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold rounded-md tr"
                  style={{ background: 'var(--bg-overlay)', color: 'var(--ink-2)', border: '1px solid var(--border-subtle)' }}>
                  <FileCode className="w-3 h-3" /> Download JSON
                </button>
              </div>
            </div>

            <section aria-labelledby="build-result-title" className="rounded-xl p-5"
                     style={{ background: run.buildResult.status === 'pass' ? 'var(--ok-dim)' : run.buildResult.status === 'warning' ? 'var(--warn-dim)' : 'var(--bad-dim)', border: '1px solid var(--border-subtle)' }}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--ink-2)', letterSpacing: '0.1em' }}>
                    Verification result
                  </p>
                  <div className="flex items-center gap-2">
                    <BuildBadge s={run.buildResult.status} />
                    <h2 id="build-result-title" className="text-lg font-bold" style={{ color: 'var(--ink)' }}>{run.buildResult.headline}</h2>
                  </div>
                </div>
                <span className="text-[11px] font-mono" style={{ color: 'var(--ink-2)' }}>
                  {run.buildResult.passedClaims} pass · {run.buildResult.warningClaims} review · {run.buildResult.failedClaims} fail
                </span>
              </div>
              <p className="text-sm leading-relaxed mt-3 max-w-3xl" style={{ color: 'var(--ink-2)' }}>{run.buildResult.explanation}</p>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              <section aria-labelledby="brief-title" className="lg:col-span-7 rounded-xl p-5"
                       style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)' }}>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--ink-3)', letterSpacing: '0.1em' }}>
                  In brief
                </p>
                <h2 id="brief-title" className="text-base font-bold mb-3" style={{ color: 'var(--ink)' }}>
                  What this run found
                </h2>
                <ul className="space-y-2.5 text-sm leading-relaxed" style={{ color: 'var(--ink-2)' }}>
                  {summaryPoints(run.summary).map((point, index) => (
                    <li key={`${point}-${index}`} className="flex items-start gap-2.5">
                      <span className="mt-2 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: 'var(--accent)' }} />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
                <details className="mt-4 pt-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  <summary className="cursor-pointer text-[11px] font-semibold" style={{ color: 'var(--accent-text)' }}>
                    Read the full synthesis
                  </summary>
                  <p className="text-xs leading-relaxed mt-3" style={{ color: 'var(--ink-2)' }}>{run.summary}</p>
                </details>
              </section>

              <section aria-labelledby="metrics-title" className="lg:col-span-5 rounded-xl p-5"
                       style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)' }}>
                <div className="flex items-center justify-between mb-3">
                  <h2 id="metrics-title" className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--ink-3)', letterSpacing: '0.1em' }}>
                    Run metrics
                  </h2>
                  {run.metrics && (
                    <span className="text-[10px] font-mono flex items-center gap-1" style={{ color: 'var(--ink-3)' }}>
                      <Clock className="w-3 h-3" /> {(run.metrics.durationMs / 1000).toFixed(1)}s
                    </span>
                  )}
                </div>
                <div className="flex gap-6 mb-3">
                  <div>
                    <span className="text-2xl font-bold" style={{ color: 'var(--ink)' }}>{total}</span>
                    <span className="block text-[10px]" style={{ color: 'var(--ink-3)' }}>Claims</span>
                  </div>
                  <div>
                    <span className="text-2xl font-bold" style={{ color: 'var(--ink)' }}>{avgConf}%</span>
                    <span className="block text-[10px]" style={{ color: 'var(--ink-3)' }}>Confidence</span>
                  </div>
                </div>
                <div className="w-full h-1 rounded-full mb-4" style={{ background: 'var(--border)' }}>
                  <div className="h-full rounded-full anim-bar" style={{ width: `${avgConf}%`, background: confColor(avgConf) }} />
                </div>
                <div className="grid grid-cols-2 gap-y-1.5 gap-x-4 text-[11px]" style={{ color: 'var(--ink-2)' }}>
                  <span className="flex items-center gap-1.5"><Layers className="w-3 h-3" style={{ color: 'var(--ink-3)' }} /><strong className="font-semibold">{run.metrics?.sourcesScanned ?? 0}</strong> sources</span>
                  <span className="flex items-center gap-1.5"><Globe className="w-3 h-3" style={{ color: 'var(--ink-3)' }} /><strong className="font-semibold">{run.metrics?.distinctDomains ?? 0}</strong> domains</span>
                  <span className="flex items-center gap-1.5"><FileText className="w-3 h-3" style={{ color: 'var(--ink-3)' }} /><strong className="font-semibold">{run.metrics?.extractedSources ?? 0}</strong> extracted</span>
                  <span className="flex items-center gap-1.5"><FileCode className="w-3 h-3" style={{ color: 'var(--ink-3)' }} /><strong className="font-semibold">{run.metrics?.snippetFallbackSources ?? 0}</strong> snippets</span>
                </div>
                <div className="flex items-center gap-2 mt-3 pt-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  {counts.ok > 0 && <span className="flex items-center gap-1 text-[10px] font-semibold" style={{ color: 'var(--ok-text)' }}><CheckCircle2 className="w-3 h-3" />{counts.ok} passed</span>}
                  {counts.bad > 0 && <span className="flex items-center gap-1 text-[10px] font-semibold" style={{ color: 'var(--bad-text)' }}><XCircle className="w-3 h-3" />{counts.bad} failed</span>}
                  {counts.warn > 0 && <span className="flex items-center gap-1 text-[10px] font-semibold" style={{ color: 'var(--warn-text)' }}><AlertTriangle className="w-3 h-3" />{counts.warn} review</span>}
                  {counts.mute > 0 && <span className="flex items-center gap-1 text-[10px] font-semibold" style={{ color: 'var(--mute-text)' }}><HelpCircle className="w-3 h-3" />{counts.mute} unclear</span>}
                </div>
              </section>
            </div>

            <section aria-labelledby="trace-title" className="rounded-xl p-5"
                     style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)' }}>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <h2 id="trace-title" className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--ink-3)', letterSpacing: '0.1em' }}>
                  Agent execution trace
                </h2>
                <span className="text-[10px] font-mono" style={{ color: 'var(--ink-3)' }}>
                  {run.manifest.pipelineVersion} · {run.manifest.model}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {run.agentTrace.map((step) => (
                  <div key={`${step.id}-${step.role}`} className="rounded-md p-3" style={{ background: 'var(--bg-inset)', border: '1px solid var(--border-subtle)' }}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold" style={{ color: 'var(--ink)' }}>{step.role}</span>
                      <span className="text-[10px] font-mono" style={{ color: step.status === 'fallback' ? 'var(--warn-text)' : 'var(--ink-3)' }}>{step.status} · {step.durationMs}ms</span>
                    </div>
                    <p className="text-[10px] mt-1" style={{ color: 'var(--ink-3)' }}>{step.note}</p>
                  </div>
                ))}
              </div>
              <details className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <summary className="cursor-pointer text-[11px] font-semibold" style={{ color: 'var(--accent-text)' }}>
                  Read reproducibility manifest
                </summary>
                <pre className="text-[10px] leading-relaxed mt-3 overflow-x-auto" style={{ color: 'var(--ink-2)' }}>{JSON.stringify(run.manifest, null, 2)}</pre>
              </details>
              {run.summaryMetadata.stale && (
                <p className="text-[11px] mt-3" style={{ color: 'var(--warn-text)' }}>
                  Stale summary: {run.summaryMetadata.staleReason}
                </p>
              )}
            </section>
          </div>
        )}

        {run && (
          <section aria-labelledby="claims-title" className="anim-in">
            <div className="flex flex-wrap items-end justify-between gap-2 mb-4">
              <div>
                <h2 id="claims-title" className="text-lg font-bold" style={{ color: 'var(--ink)' }}>Claims to review</h2>
                <p className="text-xs mt-1" style={{ color: 'var(--ink-3)' }}>Scan the digest first. Open reasoning or evidence when you need the proof.</p>
              </div>
              <span className="text-xs font-mono" style={{ color: 'var(--ink-3)' }}>{total} claims</span>
            </div>

            <div className="space-y-2 stagger">
              {run.claims.map((claim: Claim) => {
                const isOpen = !!open[claim.id];
                const isWhy = !!whyOpen[claim.id];
                const conf = pct(claim.confidence);
                return (
                  <article key={claim.id} className="rounded-lg overflow-hidden anim-in"
                           style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)' }}>
                    <div className="p-4">
                      <div className="flex flex-wrap items-start gap-2 mb-2">
                        <Badge v={claim.verdict} />
                        <BuildBadge s={claim.claimBuildStatus} />
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono font-medium" style={{ color: 'var(--ink-2)' }}>{conf}% confidence</span>
                      </div>

                      <h3 className="text-sm font-semibold leading-snug break-words mb-2" style={{ color: 'var(--ink)' }}>
                        &ldquo;{claim.text}&rdquo;
                      </h3>
                      <p className="text-xs leading-relaxed line-clamp-2" style={{ color: 'var(--ink-2)', maxWidth: '65ch' }}>
                        {claimDigestText(claim)}
                      </p>

                      {claim.auditAnchor && (
                        <div className="rounded-md p-2.5 mt-3 text-[11px]" style={{ background: 'var(--bg-inset)', border: '1px solid var(--border-subtle)' }}>
                          <span className="font-mono" style={{ color: claim.auditAnchor.matchStatus === 'unmatched' ? 'var(--bad-text)' : 'var(--accent-text)' }}>
                            Answer anchor · {claim.auditAnchor.matchStatus}
                          </span>
                          <p className="mt-1 italic" style={{ color: 'var(--ink-2)' }}>&ldquo;{claim.auditAnchor.quote}&rdquo;</p>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-2 mt-3">
                        <button type="button" onClick={() => toggleWhy(claim.id)} aria-expanded={isWhy} aria-controls={`reasoning-${claim.id}`}
                          className="inline-flex min-h-11 items-center gap-1 text-[11px] font-semibold tr rounded px-2"
                          style={{ color: 'var(--accent-text)', background: 'var(--accent-dim)' }}>
                          {isWhy ? <><ChevronUp className="w-3 h-3" /> Hide reasoning</> : <><Info className="w-3 h-3" /> Read reasoning</>}
                        </button>
                        <button type="button" onClick={() => toggle(claim.id)} aria-expanded={isOpen} aria-controls={`evidence-${claim.id}`}
                          className="inline-flex min-h-11 items-center gap-1 text-[11px] font-semibold tr rounded px-2"
                          style={{ color: 'var(--ink-2)', background: 'var(--bg-overlay)', border: '1px solid var(--border-subtle)' }}>
                          {isOpen ? <><ChevronUp className="w-3 h-3" /> Hide the evidence</> : <><ChevronDown className="w-3 h-3" /> Read the evidence ({claim.evidence.length})</>}
                        </button>
                        <button type="button" onClick={() => void reverifyClaim(claim)} disabled={reverifying[claim.id]}
                          className="inline-flex min-h-11 items-center gap-1 text-[11px] font-semibold tr rounded px-2 disabled:opacity-40"
                          style={{ color: 'var(--accent-text)', background: 'var(--accent-dim)' }}>
                          <RefreshCw className={`w-3 h-3 ${reverifying[claim.id] ? 'animate-spin' : ''}`} /> {reverifying[claim.id] ? 'Re-verifying' : 'Re-verify claim'}
                        </button>
                      </div>

                      {isWhy && (
                        <div id={`reasoning-${claim.id}`} className="mt-3 rounded-md p-3 text-[11px] space-y-3 anim-in"
                             style={{ background: 'var(--bg-inset)', border: '1px solid var(--border-subtle)' }}>
                          <p style={{ color: 'var(--ink-2)' }}>
                            <strong style={{ color: 'var(--ink)' }}>What would change this?</strong> {claim.missingEvidence}
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono break-all" style={{ color: 'var(--ink-3)' }}>Next search: {claim.nextBestQuery}</span>
                            <button type="button" onClick={() => copyNextQuery(claim.id, claim.nextBestQuery)}
                              className="inline-flex min-h-11 items-center gap-1 px-2.5 py-1 rounded tr"
                              style={{ background: 'var(--bg-overlay)', color: 'var(--ink-2)', border: '1px solid var(--border-subtle)' }}>
                              <Copy className="w-3 h-3" /> {copied === claim.id ? 'Copied' : 'Copy query'}
                            </button>
                          </div>
                          {claim.confidenceFactors && (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                              <div><span style={{ color: 'var(--ink-3)' }}>Evidence</span><span className="block font-bold" style={{ color: 'var(--ink)' }}>{claim.confidenceFactors.evidenceCount}</span></div>
                              <div><span style={{ color: 'var(--ink-3)' }}>Domains</span><span className="block font-bold" style={{ color: 'var(--ink)' }}>{claim.confidenceFactors.distinctDomains}</span></div>
                              <div><span style={{ color: 'var(--ink-3)' }}>Contradictions</span><span className="block font-bold" style={{ color: claim.confidenceFactors.hasContradiction ? 'var(--bad-text)' : 'var(--ok-text)' }}>{claim.confidenceFactors.hasContradiction ? 'Found' : 'None'}</span></div>
                              <div><span style={{ color: 'var(--ink-3)' }}>Source origins</span><span className="block font-bold" style={{ color: 'var(--ink)' }}>{claim.sourceIndependence.independentOrigins}/{claim.sourceIndependence.sourceCount}</span></div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {isOpen && (
                      <div id={`evidence-${claim.id}`} className="px-4 pb-4 space-y-2 anim-in" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                        <span className="block pt-3 text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--ink-3)', letterSpacing: '0.08em' }}>
                          Evidence ({claim.evidence.length})
                        </span>
                        {claim.evidence.length === 0 ? (
                          <p className="text-xs italic" style={{ color: 'var(--ink-3)' }}>No evidence met the relevance threshold.</p>
                        ) : (
                          claim.evidence.map((ev) => {
                            const rel = pct(ev.relevanceScore);
                            return (
                              <div key={ev.id} className="rounded-md p-3 space-y-2" style={{ background: 'var(--bg-inset)', border: '1px solid var(--border-subtle)' }}>
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <StanceBadge s={ev.stance} />
                                  <BasisBadge b={ev.evidenceBasis} />
                                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'var(--accent-dim)', color: 'var(--accent-text)' }}>
                                    Origin {ev.originGroupId}
                                  </span>
                                  <span className="ml-auto text-[10px] font-mono" style={{ color: 'var(--ink-3)' }}>{rel}%</span>
                                </div>
                                <div className="flex items-start justify-between gap-2">
                                  <a href={ev.url} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold inline-flex items-center gap-1 hover:underline break-all tr rounded" style={{ color: 'var(--ink)' }}>
                                    {ev.title}
                                    <ExternalLink className="w-3 h-3 shrink-0" style={{ color: 'var(--ink-3)' }} />
                                  </a>
                                  <span className="text-[10px] font-mono shrink-0 px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-overlay)', color: 'var(--ink-3)' }}>
                                    {ev.domain}
                                  </span>
                                </div>
                                <p className="text-[11px] leading-relaxed italic rounded px-2.5 py-2" style={{ color: 'var(--ink-2)', background: 'var(--bg)' }}>
                                  &ldquo;{ev.excerpt}&rdquo;
                                </p>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        )}
      </main>

      <footer className="mt-auto" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between text-[11px]" style={{ color: 'var(--ink-3)' }}>
          <span>VerityGraph</span>
          <span>Gemini · Tavily</span>
        </div>
      </footer>
    </div>
  );
}

'use client';

import { useState, useEffect, useRef } from 'react';
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
  ArrowRight,
  FileCode,
  Download,
  Copy,
  Check,
  Cpu,
  Minus,
} from 'lucide-react';
import { MOCK_RESEARCH_RUN } from '@/lib/mockData';
import {
  Claim,
  ClaimVerdict,
  EvidenceBasis,
  EvidenceStance,
  ResearchRun,
  VerificationBuildStatus,
  WorkflowMode,
} from '@/lib/types';

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
  const [copied, setCopied] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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
    setIsAnalyzing(true); setStageIndex(0); setError(null);
    try {
      const res = await fetch('/api/research', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selectedMode === 'audit' ? { mode: 'audit', text: t } : { mode: 'research', query: t }),
      });
      const data = await res.json();
      if (!res.ok) { setError({ message: data.error || 'Pipeline failed.', stage: data.stage || 'pipeline' }); }
      else {
        setRun(data as ResearchRun);
        const o: Record<string, boolean> = {};
        data.claims?.forEach((c: Claim) => { o[c.id] = true; });
        setOpen(o);
      }
    } catch { setError({ message: 'Network error.', stage: 'connection' }); }
    finally { setIsAnalyzing(false); }
  };

  const loadExample = () => {
    setSelectedMode('research');
    setQuery('Does coffee consumption decrease overall mortality and cardiovascular disease risk?');
    setError(null);
    inputRef.current?.focus();
  };

  const loadDemo = () => {
    setSelectedMode('audit');
    setQuery(MOCK_RESEARCH_RUN.query);
    setError(null);
    setRun({ ...MOCK_RESEARCH_RUN, createdAt: new Date().toISOString() });
    setOpen({ 'claim-1': true, 'claim-2': true, 'claim-3': true, 'claim-4': true });
  };

  const toggle = (id: string) => setOpen((p) => ({ ...p, [id]: !p[id] }));
  const toggleWhy = (id: string) => setWhyOpen((p) => ({ ...p, [id]: !p[id] }));

  const copyNextQuery = (claimId: string, nextBestQuery: string) => {
    void navigator.clipboard.writeText(nextBestQuery);
    setCopied(claimId);
    setTimeout(() => setCopied(null), 1600);
  };

  const exportReport = (format: 'md' | 'json') => {
    if (!run) return;
    const disclaimer = 'This report records retrieved evidence and automated verification. Confidence scores are heuristic and do not replace expert review.';
    if (format === 'json') {
      const blob = new Blob([JSON.stringify({ reportType: 'VerityGraph Proof-Carrying Report', disclaimer, ...run }, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'veritygraph-proof-report.json'; a.click();
      URL.revokeObjectURL(url);
      return;
    }
    const claims = run.claims.map((claim, i) => [
      `## Claim ${i + 1}: ${claim.text}`,
      `- Verdict: ${claim.verdict}`,
      `- Build status: ${claim.claimBuildStatus}`,
      `- Confidence: ${pct(claim.confidence)}%`,
      `- Source independence: ${claim.sourceIndependence.independentOrigins}/${claim.sourceIndependence.sourceCount} independent origins`,
      `- Missing evidence: ${claim.missingEvidence}`,
      `- Recommended next search: ${claim.nextBestQuery}`,
      '',
      ...claim.evidence.map((ev) => `- [${ev.stance}] ${ev.title} (${ev.url}) — ${ev.domain}; ${ev.evidenceBasis}; ${ev.originGroupId}\n  > ${ev.excerpt}`),
    ].join('\n')).join('\n\n');
    const md = [
      '# VerityGraph Proof-Carrying Report',
      '',
      `- Query: ${run.query}`,
      `- Workflow mode: ${run.workflowMode}`,
      `- Created: ${run.createdAt}`,
      `- Build status: ${run.buildResult.status} — ${run.buildResult.headline}`,
      '',
      run.summary,
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
              proof-carrying research
            </span>
          </div>
          <button type="button" onClick={() => inputRef.current?.focus()}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-semibold tr"
            style={{ color: 'var(--ink-2)', background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)' }}>
            Open verifier <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10 flex-1 w-full">
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start mb-7">
          <div className="lg:col-span-7 anim-in">
            <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 mb-5"
                 style={{ color: 'var(--accent-text)', background: 'var(--accent-dim)', border: '1px solid oklch(0.34 0.08 30)' }}>
              <Cpu className="w-3.5 h-3.5" />
              <span className="text-[11px] font-bold">Verification compiler for AI-generated knowledge</span>
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[0.96] max-w-3xl"
                style={{ color: 'var(--ink)', letterSpacing: '-0.055em' }}>
              Make every claim carry its evidence.
            </h1>
            <p className="text-base sm:text-lg leading-relaxed mt-5 max-w-2xl" style={{ color: 'var(--ink-2)' }}>
              VerityGraph turns research prompts and AI answers into auditable claim graphs: extracted claims, opposing evidence, source passages, confidence factors, and a pass / warning / fail build result.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-6 max-w-2xl">
              {[
                ['Atomic claims', 'Break broad answers into verifiable units.'],
                ['Challenge search', 'Look for support and contradiction.'],
                ['Proof report', 'Export the evidence trail.'],
              ].map(([title, body]) => (
                <div key={title} className="rounded-lg p-3" style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)' }}>
                  <span className="text-xs font-bold block" style={{ color: 'var(--ink)' }}>{title}</span>
                  <span className="text-[11px] leading-relaxed block mt-1" style={{ color: 'var(--ink-3)' }}>{body}</span>
                </div>
              ))}
            </div>
          </div>

          <aside className="lg:col-span-5 anim-in" style={{ animationDelay: '80ms' }}>
            <div className="rounded-2xl p-4 sm:p-5 shadow-2xl" style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--ink-3)', letterSpacing: '0.1em' }}>
                  Live workspace
                </span>
                {run ? <BuildBadge s={run.buildResult.status} /> : (
                  <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-semibold" style={{ color: 'var(--accent-text)', background: 'var(--accent-dim)' }}>
                    <ShieldCheck className="w-3 h-3" /> Ready
                  </span>
                )}
              </div>

              <div className="flex gap-2 mb-3" role="tablist" aria-label="Workflow mode">
                <button type="button" onClick={() => setSelectedMode('research')} aria-pressed={selectedMode === 'research'}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-bold rounded-md tr"
                  style={{ background: selectedMode === 'research' ? 'var(--accent-dim)' : 'var(--bg-overlay)', color: selectedMode === 'research' ? 'var(--accent-text)' : 'var(--ink-2)', border: '1px solid var(--border-subtle)' }}>
                  <Search className="w-3 h-3" /> Research
                </button>
                <button type="button" onClick={() => setSelectedMode('audit')} aria-pressed={selectedMode === 'audit'}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-bold rounded-md tr"
                  style={{ background: selectedMode === 'audit' ? 'var(--accent-dim)' : 'var(--bg-overlay)', color: selectedMode === 'audit' ? 'var(--accent-text)' : 'var(--ink-2)', border: '1px solid var(--border-subtle)' }}>
                  <Cpu className="w-3 h-3" /> Audit
                </button>
              </div>

              <form onSubmit={handleVerify} className="space-y-3">
                <label htmlFor="research-query" className="sr-only">
                  {selectedMode === 'audit' ? 'Paste AI-generated answer' : 'Enter research query'}
                </label>
                <textarea
                  ref={inputRef}
                  id="research-query"
                  rows={selectedMode === 'audit' ? 5 : 4}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  disabled={isAnalyzing}
                  placeholder={selectedMode === 'audit' ? 'Paste an AI-generated answer or report to audit...' : 'Enter a research hypothesis or claim to verify...'}
                  className="w-full h-32 rounded-lg px-4 py-3 text-sm resize-none overflow-y-auto tr disabled:opacity-40"
                  style={{ background: 'var(--bg-inset)', color: 'var(--ink)', border: '1px solid var(--border)' }}
                />
                <div className="flex flex-wrap gap-2">
                  <button type="submit" disabled={isAnalyzing || !query.trim()}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg disabled:opacity-30 tr"
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
                    className="inline-flex items-center gap-1 px-3 py-2 text-[11px] font-medium rounded-md disabled:opacity-30 tr"
                    style={{ background: 'var(--bg-overlay)', color: 'var(--ink-2)', border: '1px solid var(--border-subtle)' }}>
                    <RefreshCw className="w-3 h-3" /> Example
                  </button>
                  <button type="button" onClick={loadDemo} disabled={isAnalyzing}
                    className="inline-flex items-center gap-1 px-3 py-2 text-[11px] font-medium rounded-md disabled:opacity-30 tr"
                    style={{ background: 'var(--bg-overlay)', color: 'var(--ink-2)', border: '1px solid var(--border-subtle)' }}>
                    <Database className="w-3 h-3" /> Demo
                  </button>
                </div>
              </form>
            </div>
          </aside>
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

        {!run && !isAnalyzing && (
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6 anim-in">
            <div className="lg:col-span-2 rounded-xl p-5" style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)' }}>
              <h2 className="text-sm font-bold mb-2" style={{ color: 'var(--ink)' }}>What the verifier returns</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  ['Build result', 'Pass / warning / fail for the answer as a whole.'],
                  ['Claim graph', 'Every atomic claim gets a verdict and confidence cap.'],
                  ['Evidence trail', 'Source passages, domains, stance, and next search query.'],
                ].map(([title, body]) => (
                  <div key={title} className="rounded-lg p-3" style={{ background: 'var(--bg-inset)', border: '1px solid var(--border-subtle)' }}>
                    <span className="text-xs font-bold block" style={{ color: 'var(--ink)' }}>{title}</span>
                    <span className="text-[11px] leading-relaxed block mt-1" style={{ color: 'var(--ink-3)' }}>{body}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl p-5" style={{ background: 'var(--accent-dim)', border: '1px solid oklch(0.34 0.08 30)' }}>
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--accent-text)' }}>Primary action</span>
              <p className="text-sm mt-2 mb-4" style={{ color: 'var(--ink)' }}>Paste a claim, prompt, or answer. VerityGraph compiles the evidence record.</p>
              <button type="button" onClick={loadDemo} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold tr" style={{ background: 'var(--accent)', color: '#fff' }}>
                Load demo <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </section>
        )}

        {run && (
          <div className="space-y-5 anim-in">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg p-3"
                 style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)' }}>
              <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--ink-3)' }}>
                {run.workflowMode === 'audit' ? 'AI Answer Audit' : 'Research Verification'}
              </span>
              <div className="flex gap-2">
                <button type="button" onClick={() => exportReport('md')}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold rounded-md tr"
                  style={{ background: 'var(--bg-overlay)', color: 'var(--ink-2)', border: '1px solid var(--border-subtle)' }}>
                  <Download className="w-3 h-3" /> Export Markdown
                </button>
                <button type="button" onClick={() => exportReport('json')}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold rounded-md tr"
                  style={{ background: 'var(--bg-overlay)', color: 'var(--ink-2)', border: '1px solid var(--border-subtle)' }}>
                  <FileCode className="w-3 h-3" /> Export JSON
                </button>
              </div>
            </div>

            <section className="rounded-lg p-5"
                     style={{ background: run.buildResult.status === 'pass' ? 'var(--ok-dim)' : run.buildResult.status === 'warning' ? 'var(--warn-dim)' : 'var(--bad-dim)', border: '1px solid var(--border-subtle)' }}>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <BuildBadge s={run.buildResult.status} />
                  <h2 className="text-lg font-bold" style={{ color: 'var(--ink)' }}>{run.buildResult.headline}</h2>
                </div>
                <span className="text-[11px] font-mono" style={{ color: 'var(--ink-2)' }}>
                  {run.buildResult.passedClaims} pass · {run.buildResult.warningClaims} warning · {run.buildResult.failedClaims} fail
                </span>
              </div>
              <p className="text-sm" style={{ color: 'var(--ink-2)' }}>{run.buildResult.explanation}</p>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              <div className="lg:col-span-8 rounded-lg p-5"
                   style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)' }}>
                <h2 className="text-[10px] font-bold uppercase tracking-widest mb-3"
                    style={{ color: 'var(--ink-3)', letterSpacing: '0.1em' }}>
                  Summary
                </h2>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--ink)', maxWidth: '70ch' }}>
                  {run.summary}
                </p>
              </div>

              <div className="lg:col-span-4 rounded-lg p-5"
                   style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)' }}>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-[10px] font-bold uppercase tracking-widest"
                      style={{ color: 'var(--ink-3)', letterSpacing: '0.1em' }}>
                    Metrics
                  </h2>
                  {run.metrics && (
                    <span className="text-[10px] font-mono flex items-center gap-1" style={{ color: 'var(--ink-3)' }}>
                      <Clock className="w-3 h-3" />
                      {(run.metrics.durationMs / 1000).toFixed(1)}s
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
                  {counts.ok > 0 && <span className="flex items-center gap-1 text-[10px] font-semibold" style={{ color: 'var(--ok-text)' }}><CheckCircle2 className="w-3 h-3" />{counts.ok}</span>}
                  {counts.bad > 0 && <span className="flex items-center gap-1 text-[10px] font-semibold" style={{ color: 'var(--bad-text)' }}><XCircle className="w-3 h-3" />{counts.bad}</span>}
                  {counts.warn > 0 && <span className="flex items-center gap-1 text-[10px] font-semibold" style={{ color: 'var(--warn-text)' }}><AlertTriangle className="w-3 h-3" />{counts.warn}</span>}
                  {counts.mute > 0 && <span className="flex items-center gap-1 text-[10px] font-semibold" style={{ color: 'var(--mute-text)' }}><HelpCircle className="w-3 h-3" />{counts.mute}</span>}
                </div>
              </div>
            </div>

            <section>
              <div className="flex items-baseline gap-2 mb-4">
                <h2 className="text-sm font-bold" style={{ color: 'var(--ink)' }}>Verified Claims</h2>
                <span className="text-xs font-mono" style={{ color: 'var(--ink-3)' }}>{total}</span>
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
                          <span className="inline-flex items-center gap-1 text-[11px] font-mono font-medium" style={{ color: 'var(--ink-2)' }}>{conf}%</span>
                          <span className="text-[11px] font-mono" style={{ color: 'var(--ink-3)' }}>
                            {claim.sourceIndependence.independentOrigins}/{claim.sourceIndependence.sourceCount} independent origins
                          </span>
                        </div>

                        <h3 className="text-sm font-semibold leading-snug break-words mb-2" style={{ color: 'var(--ink)' }}>
                          &ldquo;{claim.text}&rdquo;
                        </h3>
                        <p className="text-xs leading-relaxed mb-3" style={{ color: 'var(--ink-2)', maxWidth: '65ch' }}>
                          {claim.explanation}
                        </p>

                        <div className="rounded-md p-3 mb-3 text-[11px] space-y-2"
                             style={{ background: 'var(--bg-inset)', border: '1px solid var(--border-subtle)' }}>
                          <p style={{ color: 'var(--ink-2)' }}>
                            <strong style={{ color: 'var(--ink)' }}>What would change this verdict?</strong> {claim.missingEvidence}
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono break-all" style={{ color: 'var(--ink-3)' }}>{claim.nextBestQuery}</span>
                            <button type="button" onClick={() => copyNextQuery(claim.id, claim.nextBestQuery)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded tr"
                              style={{ background: 'var(--bg-overlay)', color: 'var(--ink-2)', border: '1px solid var(--border-subtle)' }}>
                              <Copy className="w-3 h-3" /> {copied === claim.id ? 'Copied' : 'Copy query'}
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <button type="button" onClick={() => toggle(claim.id)} aria-expanded={isOpen}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold tr rounded px-1.5 py-0.5"
                            style={{ color: 'var(--accent-text)' }}>
                            {isOpen ? <><ChevronUp className="w-3 h-3" /> Hide evidence</> : <><ChevronDown className="w-3 h-3" /> {claim.evidence.length} source{claim.evidence.length !== 1 ? 's' : ''}</>}
                          </button>
                          <button type="button" onClick={() => toggleWhy(claim.id)} aria-expanded={isWhy}
                            className="inline-flex items-center gap-1 text-[10px] font-medium tr rounded px-1.5 py-0.5"
                            style={{ color: 'var(--ink-3)' }}>
                            <Info className="w-3 h-3" /> Why?
                          </button>
                        </div>

                        {isWhy && claim.confidenceFactors && (
                          <div className="mt-3 rounded-md p-3 text-[11px] grid grid-cols-2 sm:grid-cols-4 gap-3 anim-in"
                               style={{ background: 'var(--bg-inset)', border: '1px solid var(--border-subtle)' }}>
                            <div><span style={{ color: 'var(--ink-3)' }}>Evidence</span><span className="block font-bold" style={{ color: 'var(--ink)' }}>{claim.confidenceFactors.evidenceCount}</span></div>
                            <div><span style={{ color: 'var(--ink-3)' }}>Domains</span><span className="block font-bold" style={{ color: 'var(--ink)' }}>{claim.confidenceFactors.distinctDomains}</span></div>
                            <div><span style={{ color: 'var(--ink-3)' }}>Contradictions</span><span className="block font-bold" style={{ color: claim.confidenceFactors.hasContradiction ? 'var(--bad-text)' : 'var(--ok-text)' }}>{claim.confidenceFactors.hasContradiction ? 'Found' : 'None'}</span></div>
                            <div><span style={{ color: 'var(--ink-3)' }}>Cap</span><span className="block font-bold truncate" style={{ color: 'var(--ink)' }}>{claim.confidenceFactors.appliedCap || 'None'}</span></div>
                          </div>
                        )}
                      </div>

                      {isOpen && (
                        <div className="px-4 pb-4 space-y-2 anim-in" style={{ borderTop: '1px solid var(--border-subtle)' }}>
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
          </div>
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

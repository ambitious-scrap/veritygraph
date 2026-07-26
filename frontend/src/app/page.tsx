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
  BarChart2,
  AlertCircle,
  Database,
  Info,
  Globe,
  Clock,
  Layers,
  Sparkles,
  ArrowRight,
  KeyRound,
} from 'lucide-react';
import { MOCK_RESEARCH_RUN } from '@/lib/mockData';
import { Claim, ClaimVerdict, EvidenceStance, ResearchRun } from '@/lib/types';

const STAGES = [
  'Searching sources',
  'Extracting claims',
  'Challenging claims',
  'Verifying evidence',
  'Compiling report',
];

export default function Home() {
  const [query, setQuery] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [stageIndex, setStageIndex] = useState(0);
  const [errorDetails, setErrorDetails] = useState<{ message: string; stage?: string } | null>(
    null
  );
  // Initial state: activeRun = null (no auto-display of mock data)
  const [activeRun, setActiveRun] = useState<ResearchRun | null>(null);
  const [expandedClaims, setExpandedClaims] = useState<Record<string, boolean>>({});
  const [expandedWhyScore, setExpandedWhyScore] = useState<Record<string, boolean>>({});

  const queryTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Stage rotator effect while analyzing
  useEffect(() => {
    if (!isAnalyzing) return;
    const interval = setInterval(() => {
      setStageIndex((prev) => (prev + 1) % STAGES.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [isAnalyzing]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;

    if (trimmed.length < 10) {
      setErrorDetails({
        message: 'Query must be at least 10 characters long.',
        stage: 'initial-search',
      });
      return;
    }

    if (trimmed.length > 500) {
      setErrorDetails({
        message: 'Query must be at most 500 characters long.',
        stage: 'initial-search',
      });
      return;
    }

    setIsAnalyzing(true);
    setStageIndex(0);
    setErrorDetails(null);

    try {
      const res = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: trimmed }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorDetails({
          message: data.error || 'Failed to complete research pipeline execution.',
          stage: data.stage || 'initial-search',
        });
      } else {
        setActiveRun(data as ResearchRun);
        const newExpanded: Record<string, boolean> = {};
        if (Array.isArray(data.claims)) {
          data.claims.forEach((c: Claim) => {
            newExpanded[c.id] = true;
          });
        }
        setExpandedClaims(newExpanded);
      }
    } catch {
      setErrorDetails({
        message: 'Network error connecting to research verification service.',
        stage: 'initial-search',
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handlePopulateExample = () => {
    setQuery('Does coffee consumption decrease overall mortality and cardiovascular disease risk?');
    setErrorDetails(null);
    if (queryTextareaRef.current) {
      queryTextareaRef.current.focus();
    }
  };

  const handleLoadDemoResult = () => {
    setQuery(MOCK_RESEARCH_RUN.query);
    setErrorDetails(null);
    setActiveRun({
      ...MOCK_RESEARCH_RUN,
      createdAt: new Date().toISOString(),
    });
    setExpandedClaims({
      'claim-1': true,
      'claim-2': true,
      'claim-3': true,
      'claim-4': true,
    });
  };

  const handleFocusQueryInput = () => {
    if (queryTextareaRef.current) {
      queryTextareaRef.current.focus();
      queryTextareaRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const toggleExpand = (claimId: string) => {
    setExpandedClaims((prev) => ({
      ...prev,
      [claimId]: !prev[claimId],
    }));
  };

  const toggleWhyScore = (claimId: string) => {
    setExpandedWhyScore((prev) => ({
      ...prev,
      [claimId]: !prev[claimId],
    }));
  };

  const getVerdictBadge = (verdict: ClaimVerdict) => {
    switch (verdict) {
      case 'supported':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
            Supported
          </span>
        );
      case 'contradicted':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
            Contradicted
          </span>
        );
      case 'partial':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
            Partial Support
          </span>
        );
      case 'insufficient':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-300">
            <HelpCircle className="w-3.5 h-3.5" aria-hidden="true" />
            Insufficient Evidence
          </span>
        );
    }
  };

  const getEvidenceStanceBadge = (stance: EvidenceStance) => {
    switch (stance) {
      case 'support':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
            Supports claim
          </span>
        );
      case 'contradict':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3 h-3" aria-hidden="true" />
            Challenges claim
          </span>
        );
      case 'neutral':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            <Info className="w-3 h-3 text-slate-500" aria-hidden="true" />
            Context only
          </span>
        );
    }
  };

  const totalClaims = activeRun?.claims.length || 0;
  const supportedCount =
    activeRun?.claims.filter((c) => c.verdict === 'supported').length || 0;
  const contradictedCount =
    activeRun?.claims.filter((c) => c.verdict === 'contradicted').length || 0;
  const partialCount =
    activeRun?.claims.filter((c) => c.verdict === 'partial').length || 0;
  const insufficientCount =
    activeRun?.claims.filter((c) => c.verdict === 'insufficient').length || 0;
  const avgConfidence = totalClaims
    ? Math.round(
        activeRun!.claims.reduce(
          (acc, c) => acc + (c.confidence > 1 ? c.confidence : c.confidence * 100),
          0
        ) / totalClaims
      )
    : 0;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Navigation Header */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-900 text-white rounded-lg">
              <ShieldCheck className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight tracking-tight text-slate-900">
                VerityGraph
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Every claim must earn its evidence.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {activeRun && (
              <>
                {activeRun.mode === 'live' ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" aria-hidden="true" />
                    Live Research
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200">
                    <Database className="w-3 h-3 text-blue-600" aria-hidden="true" />
                    Demo Data
                  </span>
                )}

                {activeRun.providerMetadata?.fallbackUsed && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-300">
                    <KeyRound className="w-3 h-3 text-amber-600" aria-hidden="true" />
                    Secondary Gemini key used
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full space-y-8">
        {/* Research Input Form */}
        <section className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
          <div className="space-y-1">
            <label
              htmlFor="research-query"
              className="block text-sm font-semibold text-slate-900"
            >
              Research Query
            </label>
            <p className="text-xs text-slate-500">
              Enter a hypothesis, scientific topic, or claim set to extract and verify atomic evidence.
            </p>
          </div>

          <form onSubmit={handleVerify} className="space-y-3">
            <div className="relative">
              <textarea
                ref={queryTextareaRef}
                id="research-query"
                rows={3}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                disabled={isAnalyzing}
                placeholder="e.g. Does daily creatine monohydrate supplementation improve cognitive performance in elderly adults?"
                className="w-full rounded-lg border border-slate-300 p-3.5 text-sm text-slate-900 placeholder-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:border-transparent resize-none font-medium disabled:opacity-60"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handlePopulateExample}
                  disabled={isAnalyzing}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:outline-none"
                >
                  <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                  Try Example Query
                </button>

                <button
                  type="button"
                  onClick={handleLoadDemoResult}
                  disabled={isAnalyzing}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:outline-none"
                >
                  <Database className="w-3.5 h-3.5" aria-hidden="true" />
                  Load Demo Result
                </button>
              </div>

              <button
                type="submit"
                disabled={isAnalyzing || !query.trim()}
                className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm disabled:opacity-50 transition-colors focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:outline-none"
              >
                {isAnalyzing ? (
                  <span className="inline-flex items-center gap-2" aria-live="polite">
                    <RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" />
                    <span>{STAGES[stageIndex]}...</span>
                  </span>
                ) : (
                  <>
                    <Search className="w-4 h-4" aria-hidden="true" />
                    Verify Research
                  </>
                )}
              </button>
            </div>
          </form>
        </section>

        {/* Error Banner */}
        {errorDetails && (
          <div
            role="alert"
            className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start gap-3 text-rose-800 text-sm"
          >
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold uppercase tracking-wider text-xs bg-rose-200 text-rose-900 px-2 py-0.5 rounded font-mono">
                  Stage: {errorDetails.stage || 'pipeline'}
                </span>
                <span className="font-semibold text-slate-900">Pipeline Error</span>
              </div>
              <p className="text-xs text-rose-700">{errorDetails.message}</p>
            </div>
          </div>
        )}

        {/* Empty State when activeRun === null */}
        {!activeRun && !isAnalyzing && (
          <section className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-6 shadow-sm">
            <div className="mx-auto w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-700">
              <Sparkles className="w-6 h-6" aria-hidden="true" />
            </div>

            <div className="max-w-md mx-auto space-y-2">
              <h2 className="text-lg font-bold text-slate-900">
                Evidence-First Multi-Agent Research System
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                VerityGraph extracts atomic claims, searches scientific literature via Tavily, and evaluates supporting and challenging evidence using Google Gemini.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleFocusQueryInput}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm transition-colors focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:outline-none"
              >
                Run Live Verification
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={handleLoadDemoResult}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:outline-none"
              >
                <Database className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                Load Demo Result
              </button>
            </div>
          </section>
        )}

        {/* Results Area */}
        {activeRun && (
          <div className="space-y-8">
            {/* Executive Summary & Stats Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Executive Summary */}
              <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                  <FileText className="w-4 h-4 text-slate-700" aria-hidden="true" />
                  <h2 className="text-sm font-bold tracking-tight text-slate-900 uppercase">
                    Executive Summary
                  </h2>
                </div>
                <p className="text-sm leading-relaxed text-slate-700">
                  {activeRun.summary}
                </p>
              </div>

              {/* Verification Stats & Run Metrics */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <BarChart2 className="w-4 h-4 text-slate-700" aria-hidden="true" />
                    <h2 className="text-sm font-bold tracking-tight text-slate-900 uppercase">
                      Verification Metrics
                    </h2>
                  </div>
                  {activeRun.metrics && (
                    <span className="inline-flex items-center gap-1 text-xs text-slate-500 font-mono">
                      <Clock className="w-3 h-3 text-slate-400" aria-hidden="true" />
                      {(activeRun.metrics.durationMs / 1000).toFixed(1)}s
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <span className="block text-xs font-medium text-slate-500">
                      Total Claims
                    </span>
                    <span className="text-lg font-bold text-slate-900">
                      {totalClaims}
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <span className="block text-xs font-medium text-slate-500">
                      Avg Confidence
                    </span>
                    <span className="text-lg font-bold text-slate-900">
                      {avgConfidence}%
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <span className="block text-xs font-medium text-slate-500 inline-flex items-center gap-1">
                      <Layers className="w-3 h-3 text-slate-400" aria-hidden="true" />
                      Sources Scanned
                    </span>
                    <span className="text-lg font-bold text-slate-900">
                      {activeRun.metrics?.sourcesScanned ?? 0}
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <span className="block text-xs font-medium text-slate-500 inline-flex items-center gap-1">
                      <Globe className="w-3 h-3 text-slate-400" aria-hidden="true" />
                      Distinct Domains
                    </span>
                    <span className="text-lg font-bold text-slate-900">
                      {activeRun.metrics?.distinctDomains ?? 0}
                    </span>
                  </div>
                  <div className="p-3 bg-emerald-50/50 border border-emerald-200 rounded-lg">
                    <span className="block text-xs font-medium text-emerald-800">
                      Supported
                    </span>
                    <span className="text-lg font-bold text-emerald-900">
                      {supportedCount}
                    </span>
                  </div>
                  <div className="p-3 bg-rose-50/50 border border-rose-200 rounded-lg">
                    <span className="block text-xs font-medium text-rose-800">
                      Challenged / Insufficient
                    </span>
                    <span className="text-lg font-bold text-rose-900">
                      {contradictedCount + partialCount + insufficientCount}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Extracted & Verified Claims List */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900">
                  Extracted & Verified Claims ({totalClaims})
                </h2>
                <span className="text-xs text-slate-500">
                  Claim-level evidence verification graph
                </span>
              </div>

              <div className="space-y-4">
                {activeRun.claims.map((claim: Claim) => {
                  const isExpanded = !!expandedClaims[claim.id];
                  const isWhyExpanded = !!expandedWhyScore[claim.id];
                  const confidenceDisplay = Math.round(
                    claim.confidence > 1 ? claim.confidence : claim.confidence * 100
                  );
                  return (
                    <article
                      key={claim.id}
                      className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden transition-all"
                    >
                      {/* Card Header / Summary Line */}
                      <div className="p-5 space-y-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-2">
                            {getVerdictBadge(claim.verdict)}
                            <span className="text-xs font-medium text-slate-500">
                              Confidence: {confidenceDisplay}%
                            </span>
                            <button
                              type="button"
                              aria-expanded={isWhyExpanded}
                              onClick={() => toggleWhyScore(claim.id)}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded transition-colors focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:outline-none"
                            >
                              <Info className="w-3 h-3 text-slate-500" aria-hidden="true" />
                              Why this score?
                              {isWhyExpanded ? (
                                <ChevronUp className="w-3 h-3" aria-hidden="true" />
                              ) : (
                                <ChevronDown className="w-3 h-3" aria-hidden="true" />
                              )}
                            </button>
                          </div>
                          <button
                            type="button"
                            aria-expanded={isExpanded}
                            onClick={() => toggleExpand(claim.id)}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded transition-colors focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:outline-none"
                          >
                            {isExpanded ? (
                              <>
                                Hide Evidence Details
                                <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
                              </>
                            ) : (
                              <>
                                View {claim.evidence.length} Evidence Source
                                {claim.evidence.length > 1 ? 's' : ''}
                                <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
                              </>
                            )}
                          </button>
                        </div>

                        {/* Expandable "Why this score?" Confidence Explanation */}
                        {isWhyExpanded && claim.confidenceFactors && (
                          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs space-y-2">
                            <h3 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                              Deterministic Confidence Factors
                            </h3>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              <div className="bg-white p-2 border border-slate-200 rounded">
                                <span className="text-slate-500 block">Verified Evidence</span>
                                <span className="font-bold text-slate-900">
                                  {claim.confidenceFactors.evidenceCount} sources
                                </span>
                              </div>
                              <div className="bg-white p-2 border border-slate-200 rounded">
                                <span className="text-slate-500 block">Distinct Domains</span>
                                <span className="font-bold text-slate-900">
                                  {claim.confidenceFactors.distinctDomains} domains
                                </span>
                              </div>
                              <div className="bg-white p-2 border border-slate-200 rounded">
                                <span className="text-slate-500 block">Contradictions</span>
                                <span
                                  className={`font-bold ${
                                    claim.confidenceFactors.hasContradiction
                                      ? 'text-rose-700'
                                      : 'text-emerald-700'
                                  }`}
                                >
                                  {claim.confidenceFactors.hasContradiction ? 'Detected' : 'None'}
                                </span>
                              </div>
                              <div className="bg-white p-2 border border-slate-200 rounded">
                                <span className="text-slate-500 block">Confidence Cap</span>
                                <span className="font-bold text-slate-900 truncate block">
                                  {claim.confidenceFactors.appliedCap || 'No cap applied'}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Claim Text */}
                        <h3 className="text-base font-semibold text-slate-900 leading-snug break-words">
                          &quot;{claim.text}&quot;
                        </h3>

                        {/* Explanation */}
                        <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 border-l-2 border-slate-300 pl-3 py-1.5 break-words">
                          <span className="font-semibold text-slate-700">
                            Verdict Reasoning:
                          </span>{' '}
                          {claim.explanation}
                        </p>
                      </div>

                      {/* Expandable Evidence Details */}
                      {isExpanded && (
                        <div className="border-t border-slate-200 bg-slate-50/50 p-5 space-y-3">
                          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                            Supporting & Contradicting Evidence ({claim.evidence.length})
                          </h3>
                          {claim.evidence.length === 0 ? (
                            <p className="text-xs text-slate-500 italic">
                              No external evidence met the relevance threshold for this claim.
                            </p>
                          ) : (
                            <div className="space-y-3">
                              {claim.evidence.map((ev) => {
                                const relDisplay = Math.round(
                                  ev.relevanceScore > 1
                                    ? ev.relevanceScore
                                    : ev.relevanceScore * 100
                                );
                                return (
                                  <div
                                    key={ev.id}
                                    className="bg-white border border-slate-200 rounded-lg p-4 space-y-2 text-sm"
                                  >
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <div className="flex flex-wrap items-center gap-2">
                                        {getEvidenceStanceBadge(ev.stance)}
                                        <a
                                          href={ev.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="font-semibold text-slate-900 hover:text-blue-600 inline-flex items-center gap-1.5 hover:underline break-all focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:outline-none rounded"
                                        >
                                          {ev.title}
                                          <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                                        </a>
                                      </div>
                                      <div className="flex items-center gap-2 text-xs">
                                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">
                                          {ev.domain}
                                        </span>
                                        <span className="text-slate-500 font-medium">
                                          Relevance: {relDisplay}%
                                        </span>
                                      </div>
                                    </div>
                                    <blockquote className="text-xs text-slate-700 italic bg-slate-50 border-l-2 border-slate-300 p-2.5 rounded-r break-words">
                                      &quot;{ev.excerpt}&quot;
                                    </blockquote>
                                  </div>
                                );
                              })}
                            </div>
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

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 mt-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between text-xs text-slate-500">
          <span>VerityGraph MVP — Evidence-First Multi-Agent Research System</span>
          <span>Google Gemini Live Engine</span>
        </div>
      </footer>
    </div>
  );
}

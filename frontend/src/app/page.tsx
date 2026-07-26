'use client';

import { useState } from 'react';
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
} from 'lucide-react';
import { MOCK_RESEARCH_RUN } from '@/lib/mockData';
import { Claim, ClaimVerdict, ResearchRun } from '@/lib/types';

export default function Home() {
  const [query, setQuery] = useState(MOCK_RESEARCH_RUN.query);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeRun, setActiveRun] = useState<ResearchRun | null>(MOCK_RESEARCH_RUN);
  const [expandedClaims, setExpandedClaims] = useState<Record<string, boolean>>({
    'claim-1': true,
    'claim-2': true,
    'claim-3': true,
    'claim-4': true,
  });

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsAnalyzing(true);
    // Simulate brief processing for demo feel
    setTimeout(() => {
      setActiveRun({
        ...MOCK_RESEARCH_RUN,
        query: query.trim(),
        createdAt: new Date().toISOString(),
      });
      setIsAnalyzing(false);
    }, 400);
  };

  const handleTryExample = () => {
    setQuery(MOCK_RESEARCH_RUN.query);
    setActiveRun({
      ...MOCK_RESEARCH_RUN,
      createdAt: new Date().toISOString(),
    });
  };

  const toggleExpand = (claimId: string) => {
    setExpandedClaims((prev) => ({
      ...prev,
      [claimId]: !prev[claimId],
    }));
  };

  const getVerdictBadge = (verdict: ClaimVerdict) => {
    switch (verdict) {
      case 'supported':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Supported
          </span>
        );
      case 'contradicted':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3.5 h-3.5" />
            Contradicted
          </span>
        );
      case 'partial':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <AlertTriangle className="w-3.5 h-3.5" />
            Partial Support
          </span>
        );
      case 'insufficient':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-300">
            <HelpCircle className="w-3.5 h-3.5" />
            Insufficient Evidence
          </span>
        );
    }
  };

  // Stats calculation
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
        (activeRun!.claims.reduce((acc, c) => acc + c.confidence, 0) /
          totalClaims) *
          100
      )
    : 0;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Navigation Header */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-900 text-white rounded-lg">
              <ShieldCheck className="w-5 h-5" />
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
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
              MVP Shell v0.1
            </span>
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
                id="research-query"
                rows={3}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. Does daily creatine monohydrate supplementation improve cognitive performance in elderly adults?"
                className="w-full rounded-lg border border-slate-300 p-3.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent resize-none font-medium"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <button
                type="button"
                onClick={handleTryExample}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Try Example Query
              </button>

              <button
                type="submit"
                disabled={isAnalyzing || !query.trim()}
                className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm disabled:opacity-50 transition-colors"
              >
                {isAnalyzing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Verifying Claims...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    Verify Research
                  </>
                )}
              </button>
            </div>
          </form>
        </section>

        {/* Results Area */}
        {activeRun && (
          <div className="space-y-8">
            {/* Executive Summary & Stats Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Executive Summary */}
              <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                  <FileText className="w-4 h-4 text-slate-700" />
                  <h2 className="text-sm font-bold tracking-tight text-slate-900 uppercase">
                    Executive Summary
                  </h2>
                </div>
                <p className="text-sm leading-relaxed text-slate-700">
                  {activeRun.summary}
                </p>
              </div>

              {/* Verification Stats */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                  <BarChart2 className="w-4 h-4 text-slate-700" />
                  <h2 className="text-sm font-bold tracking-tight text-slate-900 uppercase">
                    Verification Statistics
                  </h2>
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
                      Contradicted
                    </span>
                    <span className="text-lg font-bold text-rose-900">
                      {contradictedCount}
                    </span>
                  </div>
                  <div className="p-3 bg-amber-50/50 border border-amber-200 rounded-lg">
                    <span className="block text-xs font-medium text-amber-800">
                      Partial
                    </span>
                    <span className="text-lg font-bold text-amber-900">
                      {partialCount}
                    </span>
                  </div>
                  <div className="p-3 bg-slate-100/70 border border-slate-300 rounded-lg">
                    <span className="block text-xs font-medium text-slate-700">
                      Insufficient
                    </span>
                    <span className="text-lg font-bold text-slate-900">
                      {insufficientCount}
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
                  Claim-level verification graph
                </span>
              </div>

              <div className="space-y-4">
                {activeRun.claims.map((claim: Claim) => {
                  const isExpanded = !!expandedClaims[claim.id];
                  return (
                    <article
                      key={claim.id}
                      className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden transition-all"
                    >
                      {/* Card Header / Summary Line */}
                      <div className="p-5 space-y-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="flex items-center gap-2">
                            {getVerdictBadge(claim.verdict)}
                            <span className="text-xs font-medium text-slate-500">
                              Confidence: {Math.round(claim.confidence * 100)}%
                            </span>
                          </div>
                          <button
                            onClick={() => toggleExpand(claim.id)}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded transition-colors"
                          >
                            {isExpanded ? (
                              <>
                                Hide Evidence Details
                                <ChevronUp className="w-3.5 h-3.5" />
                              </>
                            ) : (
                              <>
                                View {claim.evidence.length} Evidence Source
                                {claim.evidence.length > 1 ? 's' : ''}
                                <ChevronDown className="w-3.5 h-3.5" />
                              </>
                            )}
                          </button>
                        </div>

                        {/* Claim Text */}
                        <h3 className="text-base font-semibold text-slate-900 leading-snug">
                          &quot;{claim.text}&quot;
                        </h3>

                        {/* Explanation */}
                        <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 border-l-2 border-slate-300 pl-3 py-1.5">
                          <span className="font-semibold text-slate-700">
                            Verdict Reasoning:
                          </span>{' '}
                          {claim.explanation}
                        </p>
                      </div>

                      {/* Expandable Evidence Details */}
                      {isExpanded && (
                        <div className="border-t border-slate-200 bg-slate-50/50 p-5 space-y-3">
                          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                            Supporting & Contradicting Evidence ({claim.evidence.length})
                          </h4>
                          <div className="space-y-3">
                            {claim.evidence.map((ev) => (
                              <div
                                key={ev.id}
                                className="bg-white border border-slate-200 rounded-lg p-4 space-y-2 text-sm"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <a
                                    href={ev.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-semibold text-slate-900 hover:text-blue-600 inline-flex items-center gap-1.5 hover:underline"
                                  >
                                    {ev.title}
                                    <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  </a>
                                  <div className="flex items-center gap-2 text-xs">
                                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">
                                      {ev.domain}
                                    </span>
                                    <span className="text-slate-500 font-medium">
                                      Relevance: {Math.round(ev.relevanceScore * 100)}%
                                    </span>
                                  </div>
                                </div>
                                <blockquote className="text-xs text-slate-700 italic bg-slate-50 border-l-2 border-slate-300 p-2.5 rounded-r">
                                  &quot;{ev.excerpt}&quot;
                                </blockquote>
                              </div>
                            ))}
                          </div>
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
          <span>Next.js App Router Shell</span>
        </div>
      </footer>
    </div>
  );
}

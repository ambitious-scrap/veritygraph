import type { Claim, Evidence, ResearchRun } from './types';

type DemoClaimSeed = Pick<Claim, 'text' | 'verdict' | 'confidence' | 'explanation' | 'missingEvidence' | 'nextBestQuery'> & {
  evidence: Array<Omit<Evidence, 'id'>>;
};

export interface DemoScenario {
  id: string;
  label: string;
  mode: 'research' | 'audit';
  description: string;
  run: ResearchRun;
}

const DEMO_ANSWER =
  'Moderate daily creatine intake is associated with improved memory retention in select aging populations. Creatine supplementation produces measurable cognitive performance gains within one week of administration. Creatine monohydrate supplementation provides universal cognitive enhancement to every older adult demographic.';
const quote = (value: string) => ({
  quote: value,
  startIndex: DEMO_ANSWER.indexOf(value),
  endIndex: DEMO_ANSWER.indexOf(value) + value.length,
  matchStatus: 'exact' as const,
});

export const MOCK_RESEARCH_RUN: ResearchRun = {
  id: 'run-mock-001',
  query: DEMO_ANSWER,
  summary:
    'The audit found limited support for a population-specific memory association, while the one-week and universal-enhancement claims are contradicted or unsupported by the retained evidence. The evidence trail is useful for review, but it does not establish a universal effect.',
  createdAt: new Date().toISOString(),
  mode: 'demo',
  workflowMode: 'audit',
  providerMetadata: { fallbackUsed: false },
  summaryMetadata: {
    generatedAt: new Date().toISOString(),
    stale: false,
    staleReason: null,
  },
  agentTrace: [
    { id: 'stage-1', role: 'researcher', label: 'Initial Tavily research search', status: 'skipped', durationMs: 0, inputCount: 0, outputCount: 0, note: 'Audit mode uses the pasted answer as its source context.' },
    { id: 'stage-2', role: 'claim-decomposer', label: 'Gemini atomic claim extraction', status: 'completed', durationMs: 810, inputCount: 1, outputCount: 3, note: 'Claims were extracted from the pasted answer only.' },
    { id: 'stage-3', role: 'challenger', label: 'Support and challenge evidence retrieval', status: 'completed', durationMs: 1240, inputCount: 6, outputCount: 8, note: 'Support and challenge searches ran in parallel.' },
    { id: 'stage-4', role: 'source-reader', label: 'Tavily focused source extraction', status: 'completed', durationMs: 980, inputCount: 8, outputCount: 8, note: 'Focused source passages were retained with snippet fallback where needed.' },
    { id: 'stage-5', role: 'verifier', label: 'Gemini evidence verification', status: 'completed', durationMs: 920, inputCount: 8, outputCount: 3, note: 'All extracted claims were verified against retained evidence.' },
    { id: 'stage-6', role: 'synthesizer', label: 'Final synthesis', status: 'completed', durationMs: 610, inputCount: 3, outputCount: 1, note: 'Summary compiled from verified claim decisions only.' },
  ],
  manifest: {
    manifestVersion: '1.0',
    pipelineVersion: '2.0',
    workflowMode: 'audit',
    generatedAt: new Date().toISOString(),
    model: 'gemini-3.6-flash',
    buildRulesVersion: '1.0',
    sourceIndependenceVersion: '1.0',
    claimCount: 3,
    sourcesScanned: 8,
    retainedEvidenceCount: 5,
    focusedExtractCount: 4,
    snippetFallbackCount: 1,
    distinctDomains: 5,
    fallbackUsed: false,
    stageDurationsMs: {
      researcher: 0,
      'claim-decomposer': 810,
      challenger: 1240,
      'source-reader': 980,
      verifier: 920,
      synthesizer: 610,
    },
    searchQueries: [
      { claimId: 'claim-1', supportQuery: 'creatine memory aging systematic review', challengeQuery: 'creatine memory aging null trial' },
      { claimId: 'claim-2', supportQuery: 'creatine one week cognitive performance trial', challengeQuery: 'creatine acute seven day cognitive trial' },
      { claimId: 'claim-3', supportQuery: 'creatine universal cognitive enhancement older adults', challengeQuery: 'creatine cognitive response heterogeneity older adults' },
    ],
  },
  buildResult: {
    status: 'fail',
    headline: 'Verification build failed',
    explanation: 'One or more extracted claims failed verification or were directly contradicted by evidence.',
    passedClaims: 1,
    warningClaims: 0,
    failedClaims: 2,
  },
  metrics: {
    durationMs: 4560,
    sourcesScanned: 8,
    extractedSources: 4,
    snippetFallbackSources: 1,
    distinctDomains: 5,
    supportedClaims: 1,
    challengedClaims: 2,
    insufficientClaims: 0,
  },
  claims: [
    {
      id: 'claim-1',
      text: 'Moderate daily creatine intake is associated with improved memory retention in select aging populations.',
      sourceQuote: 'Moderate daily creatine intake is associated with improved memory retention in select aging populations.',
      verdict: 'supported',
      confidence: 0.82,
      explanation: 'The retained review and cohort passages support a population-specific association, but they do not establish a universal treatment effect.',
      claimBuildStatus: 'pass',
      confidenceFactors: { evidenceCount: 2, distinctDomains: 2, hasContradiction: false, appliedCap: null },
      sourceIndependence: { sourceCount: 2, independentOrigins: 2, duplicateGroups: 0, syndicatedSourceCount: 0 },
      missingEvidence: 'A larger preregistered trial across older adults with different baseline diets.',
      nextBestQuery: 'creatine memory retention older adults preregistered randomized trial',
      searchQueries: { support: 'creatine memory aging systematic review', challenge: 'creatine memory aging null trial' },
      auditAnchor: quote('Moderate daily creatine intake is associated with improved memory retention in select aging populations.'),
      evidence: [
        { id: 'ev-1', title: 'Creatine and Cognitive Function in Aging', url: 'https://example.org/creatine-aging-review', domain: 'example.org', excerpt: 'A review reports modest memory associations in selected aging populations.', stance: 'support', relevanceScore: 0.92, evidenceBasis: 'focused-source-extract', originGroupId: 'origin-1' },
        { id: 'ev-2', title: 'Dietary Creatine and Memory Outcomes', url: 'https://example.net/dietary-creatine-memory', domain: 'example.net', excerpt: 'A cohort analysis reports an association between intake and memory retention.', stance: 'support', relevanceScore: 0.84, evidenceBasis: 'focused-source-extract', originGroupId: 'origin-2' },
      ],
    },
    {
      id: 'claim-2',
      text: 'Creatine supplementation produces measurable cognitive performance gains within one week of administration.',
      sourceQuote: 'Creatine supplementation produces measurable cognitive performance gains within one week of administration.',
      verdict: 'contradicted',
      confidence: 0.9,
      explanation: 'The retained trial passage reports no measurable acute cognitive improvement after a one-week intervention.',
      claimBuildStatus: 'fail',
      confidenceFactors: { evidenceCount: 2, distinctDomains: 2, hasContradiction: true, appliedCap: null },
      sourceIndependence: { sourceCount: 2, independentOrigins: 2, duplicateGroups: 0, syndicatedSourceCount: 1 },
      missingEvidence: 'A controlled trial that measures cognitive outcomes after exactly seven days.',
      nextBestQuery: 'acute seven day creatine cognitive performance randomized trial',
      searchQueries: { support: 'creatine one week cognitive performance trial', challenge: 'creatine acute seven day cognitive trial' },
      auditAnchor: quote('Creatine supplementation produces measurable cognitive performance gains within one week of administration.'),
      evidence: [
        { id: 'ev-3', title: 'Short-Term Creatine Loading and Cognitive Performance', url: 'https://example.org/creatine-seven-day-trial', domain: 'example.org', excerpt: 'The seven-day intervention did not produce a measurable cognitive performance gain.', stance: 'contradict', relevanceScore: 0.95, evidenceBasis: 'focused-source-extract', originGroupId: 'origin-3' },
        { id: 'ev-4', title: 'Syndicated: Short-Term Creatine Loading and Cognitive Performance', url: 'https://example.com/creatine-seven-day-trial', domain: 'example.com', excerpt: 'The same seven-day result was republished with matching title and passage.', stance: 'contradict', relevanceScore: 0.88, evidenceBasis: 'focused-source-extract', originGroupId: 'origin-3' },
      ],
    },
    {
      id: 'claim-3',
      text: 'Creatine monohydrate supplementation provides universal cognitive enhancement to every older adult demographic.',
      sourceQuote: 'Creatine monohydrate supplementation provides universal cognitive enhancement to every older adult demographic.',
      verdict: 'insufficient',
      confidence: 0.42,
      explanation: 'The retained evidence shows heterogeneous responses and does not support a universal benefit across every demographic.',
      claimBuildStatus: 'fail',
      confidenceFactors: { evidenceCount: 1, distinctDomains: 1, hasContradiction: false, appliedCap: 'Capped at 45% (Insufficient evidence limits score)' },
      sourceIndependence: { sourceCount: 1, independentOrigins: 1, duplicateGroups: 0, syndicatedSourceCount: 0 },
      missingEvidence: 'Stratified trials comparing baseline diet, age, sex, and cognitive status.',
      nextBestQuery: 'creatine cognitive response heterogeneity older adults stratified trial',
      searchQueries: { support: 'creatine universal cognitive enhancement older adults', challenge: 'creatine cognitive response heterogeneity older adults' },
      auditAnchor: quote('Creatine monohydrate supplementation provides universal cognitive enhancement to every older adult demographic.'),
      evidence: [
        { id: 'ev-5', title: 'Heterogeneous Cognitive Responses to Creatine', url: 'https://example.edu/creatine-response-heterogeneity', domain: 'example.edu', excerpt: 'Response varied by baseline dietary intake and cognitive status.', stance: 'neutral', relevanceScore: 0.81, evidenceBasis: 'search-snippet', originGroupId: 'origin-4' },
      ],
    },
  ],
};

function makeDemoClaim(base: Claim, seed: DemoClaimSeed, claimIndex: number, mode: DemoScenario['mode'], sourceText: string): Claim {
  const evidence = seed.evidence.map((item, evidenceIndex) => ({
    ...item,
    id: `demo-${claimIndex + 1}-${evidenceIndex + 1}`,
  }));
  const independentOrigins = new Set(evidence.map((item) => item.originGroupId)).size;
  const anchorStart = mode === 'audit' ? sourceText.indexOf(seed.text) : -1;
  const claimBuildStatus = seed.verdict === 'contradicted' || (seed.verdict === 'insufficient' && seed.confidence <= 0.3)
    ? 'fail'
    : seed.verdict === 'supported' && seed.confidence >= 0.7 && independentOrigins >= 2
      ? 'pass'
      : 'warning';

  return {
    ...base,
    id: `claim-${claimIndex + 1}`,
    text: seed.text,
    sourceQuote: mode === 'audit' ? seed.text : undefined,
    auditAnchor: mode === 'audit'
      ? {
        quote: seed.text,
        startIndex: anchorStart >= 0 ? anchorStart : null,
        endIndex: anchorStart >= 0 ? anchorStart + seed.text.length : null,
        matchStatus: anchorStart >= 0 ? 'exact' : 'unmatched',
      }
      : undefined,
    verdict: seed.verdict,
    confidence: seed.confidence,
    explanation: seed.explanation,
    evidence,
    confidenceFactors: {
      evidenceCount: evidence.length,
      distinctDomains: new Set(evidence.map((item) => item.domain)).size,
      hasContradiction: evidence.some((item) => item.stance === 'contradict'),
      appliedCap: seed.verdict === 'insufficient' ? 'Capped by insufficient evidence' : null,
    },
    sourceIndependence: {
      sourceCount: evidence.length,
      independentOrigins,
      duplicateGroups: evidence.length - independentOrigins,
      syndicatedSourceCount: 0,
    },
    missingEvidence: seed.missingEvidence,
    nextBestQuery: seed.nextBestQuery,
    searchQueries: {
      support: `${seed.text} supporting evidence`,
      challenge: `${seed.text} limitations study`,
    },
    claimBuildStatus,
  };
}

function makeDemoRun(
  base: ResearchRun,
  config: {
    id: string;
    mode: DemoScenario['mode'];
    query: string;
    summary: string;
    claims: DemoClaimSeed[];
  },
): ResearchRun {
  const claims = config.claims.map((seed, index) => makeDemoClaim(base.claims[index], seed, index, config.mode, config.query));
  const supportedClaims = claims.filter((claim) => claim.verdict === 'supported').length;
  const warningClaims = claims.filter((claim) => claim.claimBuildStatus === 'warning').length;
  const failedClaims = claims.filter((claim) => claim.claimBuildStatus === 'fail').length;
  const retainedUrls = new Set(claims.flatMap((claim) => claim.evidence.map((item) => item.url)));
  const focusedExtracts = claims.reduce((count, claim) => count + claim.evidence.filter((item) => item.evidenceBasis === 'focused-source-extract').length, 0);
  const status = failedClaims > 0 ? 'fail' : warningClaims > 0 ? 'warning' : 'pass';
  const now = new Date().toISOString();

  return {
    ...base,
    id: config.id,
    query: config.query,
    summary: config.summary,
    claims,
    mode: 'demo',
    workflowMode: config.mode,
    createdAt: now,
    buildResult: {
      status,
      headline: status === 'fail' ? 'Verification build failed' : status === 'warning' ? 'Verification needs review' : 'Verification build passed',
      explanation: status === 'fail'
        ? 'One or more claims were contradicted or lacked enough evidence.'
        : status === 'warning'
          ? 'The evidence trail is useful, but some claims need additional review.'
          : 'Every claim met the deterministic support and independence rules.',
      passedClaims: supportedClaims,
      warningClaims,
      failedClaims,
    },
    metrics: {
      ...base.metrics,
      durationMs: 3200 + claims.length * 280,
      sourcesScanned: retainedUrls.size + 2,
      extractedSources: focusedExtracts,
      snippetFallbackSources: claims.flatMap((claim) => claim.evidence).filter((item) => item.evidenceBasis === 'search-snippet').length,
      distinctDomains: new Set(claims.flatMap((claim) => claim.evidence.map((item) => item.domain))).size,
      supportedClaims,
      challengedClaims: claims.filter((claim) => claim.verdict === 'contradicted' || claim.verdict === 'partial').length,
      insufficientClaims: claims.filter((claim) => claim.verdict === 'insufficient').length,
    },
    agentTrace: base.agentTrace.map((step, index) => ({
      ...step,
      id: `${config.id}-${step.role}`,
      status: index === 0 && config.mode === 'research' ? 'completed' : index === 0 ? 'skipped' : 'completed',
      note: index === 0 && config.mode === 'research'
        ? 'Initial search gathered context for the research question.'
        : index === 0
          ? 'Audit mode uses the pasted answer as its source context.'
          : step.note,
    })),
    manifest: {
      ...base.manifest,
      workflowMode: config.mode,
      generatedAt: now,
      claimCount: claims.length,
      sourcesScanned: retainedUrls.size + 2,
      retainedEvidenceCount: retainedUrls.size,
      focusedExtractCount: focusedExtracts,
      snippetFallbackCount: claims.flatMap((claim) => claim.evidence).filter((item) => item.evidenceBasis === 'search-snippet').length,
      distinctDomains: new Set(claims.flatMap((claim) => claim.evidence.map((item) => item.domain))).size,
      searchQueries: claims.map((claim) => ({
        claimId: claim.id,
        supportQuery: claim.searchQueries.support,
        challengeQuery: claim.searchQueries.challenge,
      })),
    },
    summaryMetadata: {
      generatedAt: now,
      stale: false,
      staleReason: null,
    },
  };
}

const COFFEE_RESEARCH_RUN = makeDemoRun(MOCK_RESEARCH_RUN, {
  id: 'run-demo-coffee',
  mode: 'research',
  query: 'Does moderate coffee consumption affect long-term health outcomes?',
  summary: 'Moderate coffee consumption is associated with lower risk in several observational studies, but the evidence does not prove that coffee itself causes better health outcomes. Effects vary by dose, population, and outcome.',
  claims: [
    {
      text: 'Moderate coffee consumption is associated with lower all-cause mortality in some populations.',
      verdict: 'supported',
      confidence: 0.78,
      explanation: 'Large cohort studies report an association, although residual lifestyle confounding limits causal interpretation.',
      missingEvidence: 'A long-term randomized trial that controls for baseline health and lifestyle factors.',
      nextBestQuery: 'coffee consumption all-cause mortality dose response meta-analysis',
      evidence: [
        { title: 'Coffee and All-Cause Mortality Review', url: 'https://example.org/coffee-mortality-review', domain: 'example.org', excerpt: 'Several cohorts report lower mortality among moderate coffee consumers.', stance: 'support', relevanceScore: 0.91, evidenceBasis: 'focused-source-extract', originGroupId: 'coffee-origin-1' },
        { title: 'Dietary Patterns and Coffee Intake', url: 'https://example.net/coffee-cohort', domain: 'example.net', excerpt: 'The observed association persisted after adjustment for several lifestyle variables.', stance: 'support', relevanceScore: 0.82, evidenceBasis: 'focused-source-extract', originGroupId: 'coffee-origin-2' },
      ],
    },
    {
      text: 'Coffee consumption prevents cardiovascular disease for every adult.',
      verdict: 'insufficient',
      confidence: 0.38,
      explanation: 'Evidence varies by dose and baseline health; the universal prevention claim is stronger than the studies support.',
      missingEvidence: 'Randomized evidence across different cardiovascular risk groups and consumption levels.',
      nextBestQuery: 'coffee cardiovascular disease randomized dose response trial',
      evidence: [
        { title: 'Coffee and Cardiovascular Outcomes', url: 'https://example.edu/coffee-cardiovascular', domain: 'example.edu', excerpt: 'Associations differ across dose ranges and cardiovascular endpoints.', stance: 'neutral', relevanceScore: 0.8, evidenceBasis: 'focused-source-extract', originGroupId: 'coffee-origin-3' },
      ],
    },
    {
      text: 'Removing coffee from the diet is necessary to improve heart health.',
      verdict: 'contradicted',
      confidence: 0.86,
      explanation: 'The retained evidence does not support a universal need to remove coffee and reports mixed or neutral outcomes at moderate intake.',
      missingEvidence: 'A controlled intervention showing harm from moderate coffee intake.',
      nextBestQuery: 'moderate coffee intake heart health controlled intervention',
      evidence: [
        { title: 'Moderate Coffee Intake and Heart Health', url: 'https://example.com/coffee-heart-health', domain: 'example.com', excerpt: 'Moderate intake was not associated with a consistent increase in cardiovascular risk.', stance: 'contradict', relevanceScore: 0.93, evidenceBasis: 'focused-source-extract', originGroupId: 'coffee-origin-4' },
      ],
    },
  ],
});

const REMOTE_WORK_RESEARCH_RUN = makeDemoRun(MOCK_RESEARCH_RUN, {
  id: 'run-demo-remote-work',
  mode: 'research',
  query: 'Does remote work improve employee productivity?',
  summary: 'Remote work can improve productivity for some roles and workers, while coordination costs and role differences produce mixed results. The evidence does not support one universal workplace policy.',
  claims: [
    {
      text: 'Remote work improves measured productivity for some knowledge-work teams.',
      verdict: 'partial',
      confidence: 0.69,
      explanation: 'Field studies report productivity gains in selected teams, but results depend on task design, management, and worker experience.',
      missingEvidence: 'Comparable measurements across more industries and longer time periods.',
      nextBestQuery: 'remote work productivity field experiment knowledge workers',
      evidence: [
        { title: 'Remote Work Field Study', url: 'https://example.org/remote-productivity-study', domain: 'example.org', excerpt: 'Selected teams completed more measured tasks while working remotely.', stance: 'support', relevanceScore: 0.88, evidenceBasis: 'focused-source-extract', originGroupId: 'remote-origin-1' },
        { title: 'Distributed Teams and Coordination', url: 'https://example.net/distributed-coordination', domain: 'example.net', excerpt: 'Coordination overhead reduced gains for interdependent work.', stance: 'contradict', relevanceScore: 0.83, evidenceBasis: 'focused-source-extract', originGroupId: 'remote-origin-2' },
      ],
    },
    {
      text: 'Remote work always increases productivity regardless of role or team structure.',
      verdict: 'contradicted',
      confidence: 0.91,
      explanation: 'The evidence shows meaningful variation by role, collaboration needs, and management practices.',
      missingEvidence: 'A universal cross-role study with the same productivity measure.',
      nextBestQuery: 'remote work productivity role heterogeneity cross industry study',
      evidence: [
        { title: 'Hybrid Work Across Job Families', url: 'https://example.edu/hybrid-job-families', domain: 'example.edu', excerpt: 'Productivity effects differed substantially between independent and interdependent roles.', stance: 'contradict', relevanceScore: 0.95, evidenceBasis: 'focused-source-extract', originGroupId: 'remote-origin-3' },
      ],
    },
    {
      text: 'Remote work eliminates the need for in-person collaboration.',
      verdict: 'insufficient',
      confidence: 0.31,
      explanation: 'The supplied evidence does not establish that remote work can replace every form of in-person collaboration.',
      missingEvidence: 'Longitudinal comparisons of creative, onboarding, and complex coordination work.',
      nextBestQuery: 'remote work in person collaboration creative onboarding outcomes',
      evidence: [
        { title: 'Collaboration in Hybrid Organizations', url: 'https://example.com/hybrid-collaboration', domain: 'example.com', excerpt: 'Some collaboration tasks remained easier to coordinate in person.', stance: 'neutral', relevanceScore: 0.79, evidenceBasis: 'search-snippet', originGroupId: 'remote-origin-4' },
      ],
    },
  ],
});

const EV_RESEARCH_RUN = makeDemoRun(MOCK_RESEARCH_RUN, {
  id: 'run-demo-ev',
  mode: 'audit',
  query: 'Electric vehicles produce no tailpipe emissions during operation. Electric vehicles are cleaner in every situation than combustion vehicles. Electric vehicle adoption immediately solves urban air pollution.',
  summary: 'The audit separates a true operational-emissions distinction from overbroad environmental claims. Electric vehicles can reduce tailpipe pollution, but lifecycle impacts depend on electricity generation, battery production, and deployment context.',
  claims: [
    {
      text: 'Electric vehicles produce no tailpipe emissions during operation.',
      verdict: 'supported',
      confidence: 0.94,
      explanation: 'Electric drivetrains have no tailpipe exhaust, although this does not describe the full lifecycle footprint.',
      missingEvidence: 'A lifecycle comparison for the specific vehicle and electricity mix.',
      nextBestQuery: 'electric vehicle zero tailpipe emissions lifecycle definition',
      evidence: [
        { title: 'Vehicle Exhaust and Electric Drivetrains', url: 'https://example.org/ev-tailpipe', domain: 'example.org', excerpt: 'Battery-electric vehicles do not emit exhaust through a tailpipe during operation.', stance: 'support', relevanceScore: 0.98, evidenceBasis: 'focused-source-extract', originGroupId: 'ev-origin-1' },
        { title: 'Transport Emissions Inventory', url: 'https://example.net/transport-emissions', domain: 'example.net', excerpt: 'Operational tailpipe emissions are distinct from upstream electricity emissions.', stance: 'support', relevanceScore: 0.9, evidenceBasis: 'focused-source-extract', originGroupId: 'ev-origin-2' },
      ],
    },
    {
      text: 'Electric vehicles are cleaner in every situation than combustion vehicles.',
      verdict: 'insufficient',
      confidence: 0.44,
      explanation: 'Lifecycle comparisons vary with vehicle size, battery manufacturing, electricity mix, and replacement timing.',
      missingEvidence: 'A matched lifecycle analysis covering the exact vehicles, grid, and driving patterns.',
      nextBestQuery: 'electric vehicle lifecycle emissions grid mix matched vehicle analysis',
      evidence: [
        { title: 'Lifecycle Emissions of Passenger Vehicles', url: 'https://example.edu/vehicle-lifecycle', domain: 'example.edu', excerpt: 'Lifecycle differences depend on manufacturing and electricity assumptions.', stance: 'neutral', relevanceScore: 0.9, evidenceBasis: 'focused-source-extract', originGroupId: 'ev-origin-3' },
      ],
    },
    {
      text: 'Electric vehicle adoption immediately solves urban air pollution.',
      verdict: 'partial',
      confidence: 0.62,
      explanation: 'Removing tailpipe exhaust can reduce some local pollutants, but adoption speed, fleet composition, and non-tailpipe particles still matter.',
      missingEvidence: 'City-level measurements before and after large-scale fleet transitions.',
      nextBestQuery: 'electric vehicle adoption urban air pollution city level study',
      evidence: [
        { title: 'Urban Air Quality After Fleet Electrification', url: 'https://example.com/urban-ev-air-quality', domain: 'example.com', excerpt: 'Fleet electrification reduced some roadside pollutants while other sources remained.', stance: 'support', relevanceScore: 0.86, evidenceBasis: 'focused-source-extract', originGroupId: 'ev-origin-4' },
        { title: 'Non-Tailpipe Traffic Particles', url: 'https://example.co/non-tailpipe-particles', domain: 'example.co', excerpt: 'Road dust and tire wear remain sources of urban particulate matter.', stance: 'contradict', relevanceScore: 0.84, evidenceBasis: 'search-snippet', originGroupId: 'ev-origin-5' },
      ],
    },
  ],
});

export const DEMO_SCENARIOS: DemoScenario[] = [
  {
    id: 'creatine-audit',
    label: 'Creatine audit',
    mode: 'audit',
    description: 'Separate a plausible memory association from overconfident universal claims.',
    run: MOCK_RESEARCH_RUN,
  },
  {
    id: 'coffee-research',
    label: 'Coffee research',
    mode: 'research',
    description: 'Compare observational associations with causal health claims.',
    run: COFFEE_RESEARCH_RUN,
  },
  {
    id: 'remote-work-research',
    label: 'Remote work',
    mode: 'research',
    description: 'Expose role-dependent results hidden behind a universal productivity claim.',
    run: REMOTE_WORK_RESEARCH_RUN,
  },
  {
    id: 'ev-audit',
    label: 'EV audit',
    mode: 'audit',
    description: 'Trace an environmental claim from a true detail to broader unsupported conclusions.',
    run: EV_RESEARCH_RUN,
  },
];

import { ResearchRun } from './types';

export const MOCK_RESEARCH_RUN: ResearchRun = {
  id: 'run-mock-001',
  query:
    'Creatine supplementation consistently improves memory in every older adult. It completely prevents age-related cognitive decline and produces measurable cognitive benefits within one week.',
  summary:
    'Audit synthesis indicates that while creatine monohydrate supplementation shows modest cognitive benefits in specific clinical sub-groups, the pasted claims asserting immediate 1-week prevention of cognitive decline and universal memory improvements across all older adults are unproven or directly contradicted by trial literature.',
  createdAt: new Date().toISOString(),
  mode: 'demo',
  workflowMode: 'audit',
  providerMetadata: {
    fallbackUsed: false,
  },
  buildResult: {
    status: 'fail',
    headline: 'Verification build failed',
    explanation:
      'One or more extracted claims failed verification or were directly contradicted by scientific literature.',
    passedClaims: 1,
    warningClaims: 1,
    failedClaims: 2,
  },
  metrics: {
    durationMs: 4200,
    sourcesScanned: 18,
    extractedSources: 4,
    snippetFallbackSources: 1,
    distinctDomains: 12,
    supportedClaims: 1,
    challengedClaims: 2,
    insufficientClaims: 1,
  },
  claims: [
    {
      id: 'claim-1',
      text: 'Moderate daily creatine intake (3–5g) is associated with improved memory retention in select aging populations.',
      verdict: 'supported',
      confidence: 0.94,
      explanation:
        'Corroborated by systematic review meta-analyses showing statistically significant improvements in spatial memory tasks among elderly participants.',
      claimBuildStatus: 'pass',
      confidenceFactors: {
        evidenceCount: 2,
        distinctDomains: 2,
        hasContradiction: false,
        appliedCap: 'Capped at 95% (Global confidence upper bound)',
      },
      sourceIndependence: {
        sourceCount: 2,
        independentOrigins: 2,
        duplicateGroups: 0,
      },
      missingEvidence:
        'Large-scale 5-year longitudinal RCT data evaluating long-term memory maintenance across diverse ethnic cohorts.',
      nextBestQuery:
        'longitudinal randomized controlled trial creatine monohydrate cognitive memory aging',
      evidence: [
        {
          id: 'ev-1',
          title: 'Coffee & Creatine Biomarkers in Aging: A Multiethnic Cohort Study',
          url: 'https://doi.org/10.7326/M16-2472',
          domain: 'acpjournals.org',
          excerpt:
            'Inverse association observed between dietary creatine/antioxidant intake and neurocognitive memory decline in older participants.',
          stance: 'support',
          relevanceScore: 0.96,
          evidenceBasis: 'focused-source-extract',
          originGroupId: 'Group A',
        },
        {
          id: 'ev-2',
          title: 'Systematic Review of Creatine Supplementation and Cognitive Function in Adults',
          url: 'https://www.bmj.com/content/359/bmj.j4342',
          domain: 'bmj.com',
          excerpt:
            'Creatine monohydrate was consistently associated with enhanced short-term memory performance across prospective randomized controlled trials.',
          stance: 'support',
          relevanceScore: 0.92,
          evidenceBasis: 'focused-source-extract',
          originGroupId: 'Group B',
        },
      ],
    },
    {
      id: 'claim-2',
      text: 'Creatine supplementation produces measurable cognitive performance gains within one week of administration.',
      verdict: 'contradicted',
      confidence: 0.89,
      explanation:
        'Clinical trial data contradict acute 1-week performance claims; brain tissue creatine accumulation requires a minimum of 4–6 weeks of consistent loading.',
      claimBuildStatus: 'fail',
      confidenceFactors: {
        evidenceCount: 2,
        distinctDomains: 2,
        hasContradiction: true,
        appliedCap: null,
      },
      sourceIndependence: {
        sourceCount: 2,
        independentOrigins: 1,
        duplicateGroups: 1,
      },
      missingEvidence:
        'Controlled neuroimaging studies demonstrating significant brain phosphocreatine elevation within 7 days of daily oral dosing.',
      nextBestQuery:
        'acute brain phosphocreatine elevation 7 days creatine monohydrate loading trial',
      evidence: [
        {
          id: 'ev-3',
          title: 'Hemodynamic and Brain Phosphocreatine Kinetics in Short-Term Creatine Loading',
          url: 'https://www.hyp.org/article/S0895-7061(02)02981-6',
          domain: 'ajh.oxfordjournals.org',
          excerpt:
            'Acute 7-day administration resulted in no statistically significant increase in cerebral cortex phosphocreatine levels (p = 0.42).',
          stance: 'contradict',
          relevanceScore: 0.95,
          evidenceBasis: 'focused-source-extract',
          originGroupId: 'Group A',
        },
        {
          id: 'ev-3b',
          title: 'Syndicated Report: Hemodynamic and Brain Kinetics of Short-Term Creatine',
          url: 'https://www.mednews-syndicate.org/article/S0895-7061(02)02981-6',
          domain: 'mednews-syndicate.org',
          excerpt:
            'Acute 7-day administration produced no statistically significant change in cerebral cortex phosphocreatine concentration.',
          stance: 'contradict',
          relevanceScore: 0.91,
          evidenceBasis: 'focused-source-extract',
          originGroupId: 'Group A',
        },
      ],
    },
    {
      id: 'claim-3',
      text: 'Creatine supplementation completely prevents age-related neurodegenerative cognitive decline.',
      verdict: 'partial',
      confidence: 0.75,
      explanation:
        'Reductions in cellular bioenergetic fatigue are documented in specific high-stress models, but absolute prevention of neurodegeneration is unverified.',
      claimBuildStatus: 'warning',
      confidenceFactors: {
        evidenceCount: 1,
        distinctDomains: 1,
        hasContradiction: false,
        appliedCap: 'Capped at 75% (Partial support limits score)',
      },
      sourceIndependence: {
        sourceCount: 1,
        independentOrigins: 1,
        duplicateGroups: 0,
      },
      missingEvidence:
        'Phase III clinical trials demonstrating disease-modifying neuroprotective arrest of Alzheimer or Parkinson pathology.',
      nextBestQuery:
        'creatine monohydrate disease modification neuroprotection clinical trial phase 3',
      evidence: [
        {
          id: 'ev-4',
          title: 'Creatine Bioenergetics and Cellular Stress Markers in Clinical Models',
          url: 'https://ajcn.nutrition.org/article/S0002-9165(23)00112-9',
          domain: 'ajcn.nutrition.org',
          excerpt:
            'Significant mitigation of oxidative stress biomarkers noted in metabolic stress cohorts (p < 0.01), but disease modification was unproven.',
          stance: 'neutral',
          relevanceScore: 0.88,
          evidenceBasis: 'focused-source-extract',
          originGroupId: 'Group A',
        },
      ],
    },
    {
      id: 'claim-4',
      text: 'Creatine monohydrate supplementation provides universal cognitive enhancement to every older adult demographic.',
      verdict: 'insufficient',
      confidence: 0.42,
      explanation:
        'Heterogeneity across baseline dietary creatine levels and baseline cognitive function creates significant variance in response rates.',
      claimBuildStatus: 'fail',
      confidenceFactors: {
        evidenceCount: 1,
        distinctDomains: 1,
        hasContradiction: false,
        appliedCap: 'Capped at 45% (Insufficient evidence limits score)',
      },
      sourceIndependence: {
        sourceCount: 1,
        independentOrigins: 1,
        duplicateGroups: 0,
      },
      missingEvidence:
        'Stratified meta-analyses measuring cognitive outcomes across omnivorous vs vegetarian elderly populations.',
      nextBestQuery:
        'dietary creatine baseline status cognitive response variance elderly trial',
      evidence: [
        {
          id: 'ev-5',
          title: 'Dietary Creatine Variations and Risk of Cognitive Response Heterogeneity',
          url: 'https://www.neurology.org/doi/10.1212/WNL.57.9.1683',
          domain: 'neurology.org',
          excerpt:
            'Strong response variability observed; omnivorous individuals with high baseline dietary creatine showed minimal cognitive benefit.',
          stance: 'neutral',
          relevanceScore: 0.81,
          evidenceBasis: 'search-snippet',
          originGroupId: 'Group A',
        },
      ],
    },
  ],
};

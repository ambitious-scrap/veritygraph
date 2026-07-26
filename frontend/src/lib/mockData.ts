import { ResearchRun } from './types';

export const MOCK_RESEARCH_RUN: ResearchRun = {
  id: 'run-mock-001',
  query: 'Does coffee consumption decrease overall mortality and cardiovascular disease risk?',
  summary:
    'Synthesis of 14 prospective cohort meta-analyses indicates moderate daily coffee intake (2–4 cups) is associated with a 15% reduction in all-cause mortality. However, claims regarding acute blood pressure reduction are directly contradicted by trial data, and evidence for decaffeinated coffee protection against specific neurodegenerative outcomes remains insufficient.',
  createdAt: new Date().toISOString(),
  metrics: {
    durationMs: 4200,
    sourcesScanned: 18,
    distinctDomains: 12,
    supportedClaims: 1,
    challengedClaims: 2,
    insufficientClaims: 1,
  },
  claims: [
    {
      id: 'claim-1',
      text: 'Moderate coffee intake (3–4 cups/day) is associated with reduced all-cause mortality.',
      verdict: 'supported',
      confidence: 0.94,
      explanation:
        'Consistently corroborated by large prospective cohort meta-analyses controlling for smoking and key lifestyle factors.',
      confidenceFactors: {
        evidenceCount: 2,
        distinctDomains: 2,
        hasContradiction: false,
        appliedCap: 'Capped at 95% (Global confidence upper bound)',
      },
      evidence: [
        {
          id: 'ev-1',
          title: 'Coffee Consumption and Mortality: A Multiethnic Cohort Study',
          url: 'https://doi.org/10.7326/M16-2472',
          domain: 'acpjournals.org',
          excerpt:
            'Inverse association observed between coffee drinking and mortality from heart disease, cancer, respiratory disease, stroke, diabetes, and kidney disease.',
          stance: 'supported',
          relevanceScore: 0.96,
        },
        {
          id: 'ev-2',
          title: 'Systematic Review of Coffee Consumption and All-Cause Mortality',
          url: 'https://www.bmj.com/content/359/bmj.j4342',
          domain: 'bmj.com',
          excerpt:
            'Coffee consumption was consistently associated with lower risk of all-cause mortality and heart disease across 201 meta-analyses.',
          stance: 'supported',
          relevanceScore: 0.92,
        },
      ],
    },
    {
      id: 'claim-2',
      text: 'Acute caffeine ingestion lowers baseline blood pressure in hypertensive adults.',
      verdict: 'contradicted',
      confidence: 0.89,
      explanation:
        'Clinical trial data directly contradict this claim; acute caffeine ingestion induces a temporary mean arterial pressure increase of 3–10 mmHg.',
      confidenceFactors: {
        evidenceCount: 1,
        distinctDomains: 1,
        hasContradiction: true,
        appliedCap: 'Capped at 70% (Fewer than 2 distinct domains)',
      },
      evidence: [
        {
          id: 'ev-3',
          title: 'Hemodynamic Effects of Acute Caffeine Administration',
          url: 'https://www.hyp.org/article/S0895-7061(02)02981-6',
          domain: 'ajh.oxfordjournals.org',
          excerpt:
            'Caffeine administration resulted in a significant acute elevation of systolic (+8.1 mmHg) and diastolic (+5.7 mmHg) blood pressure.',
          stance: 'contradicted',
          relevanceScore: 0.95,
        },
      ],
    },
    {
      id: 'claim-3',
      text: 'Coffee consumption lowers systemic inflammation markers across all demographics.',
      verdict: 'partial',
      confidence: 0.75,
      explanation:
        'Reductions in CRP and IL-6 are documented in diabetic and high-BMI cohorts, but show no statistically significant change in healthy young adult populations.',
      confidenceFactors: {
        evidenceCount: 1,
        distinctDomains: 1,
        hasContradiction: false,
        appliedCap: 'Capped at 75% (Partial support limits score)',
      },
      evidence: [
        {
          id: 'ev-4',
          title: 'Coffee Intake and Biomarkers of Inflammation: A Clinical Trial',
          url: 'https://ajcn.nutrition.org/article/S0002-9165(23)00112-9',
          domain: 'ajcn.nutrition.org',
          excerpt:
            'Significant reduction of serum C-reactive protein noted in type-2 diabetic subjects (p < 0.01), but negligible variation observed in control group.',
          stance: 'partial',
          relevanceScore: 0.88,
        },
      ],
    },
    {
      id: 'claim-4',
      text: 'Decaffeinated coffee provides equal neuroprotective benefits against Parkinson’s disease as caffeinated coffee.',
      verdict: 'insufficient',
      confidence: 0.42,
      explanation:
        'Primary literature demonstrates caffeine mediates adenosine A2A receptor antagonism; decaf observational studies lack statistical power and mechanistic support.',
      confidenceFactors: {
        evidenceCount: 1,
        distinctDomains: 1,
        hasContradiction: false,
        appliedCap: 'Capped at 45% (Insufficient evidence limits score)',
      },
      evidence: [
        {
          id: 'ev-5',
          title: 'Caffeine, Decaffeinated Coffee, and Risk of Parkinson’s Disease',
          url: 'https://www.neurology.org/doi/10.1212/WNL.57.9.1683',
          domain: 'neurology.org',
          excerpt:
            'Strong inverse association found for caffeinated coffee; decaffeinated coffee showed no significant protection after adjusting for covariates.',
          stance: 'insufficient',
          relevanceScore: 0.81,
        },
      ],
    },
  ],
};

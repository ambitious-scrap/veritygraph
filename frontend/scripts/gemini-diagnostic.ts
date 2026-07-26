import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { GoogleGenAI, Type } from '@google/genai';
import {
  inspectGeminiError,
  type GeminiDiagnosticCategory,
} from '../src/lib/gemini.ts';

type DiagnosticTest = 'basic' | 'responseSchema' | 'responseJsonSchema';
type KeySlot = 'primary' | 'secondary';

type DiagnosticRow = {
  keySlot: KeySlot;
  model: string;
  test: DiagnosticTest;
  success: boolean;
  httpStatus: number | null;
  providerErrorCode: string | null;
  categorizedResult: GeminiDiagnosticCategory;
};

const TIMEOUT_MS = 20_000;
const REQUIRED_ENV_KEYS = [
  'GEMINI_API_KEY_PRIMARY',
  'GEMINI_API_KEY_SECONDARY',
  'GEMINI_MODEL',
] as const;

function loadLocalEnvironment() {
  for (const filename of ['.env.local', '.env']) {
    try {
      const content = readFileSync(join(process.cwd(), filename), 'utf8');
      for (const line of content.split(/\r?\n/)) {
        const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (!match) continue;
        const [, key, rawValue] = match;
        if (!REQUIRED_ENV_KEYS.includes(key as (typeof REQUIRED_ENV_KEYS)[number])) continue;
        if (process.env[key]) continue;
        process.env[key] = rawValue.replace(/^['"]|['"]$/g, '');
      }
    } catch {
      // Missing env file is handled by the safe missing-key rows below.
    }
  }
}

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      const error = new Error('Gemini diagnostic timed out');
      error.name = 'TimeoutError';
      reject(error);
    }, TIMEOUT_MS);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

function structuredConfig(test: DiagnosticTest) {
  if (test === 'basic') return undefined;
  if (test === 'responseSchema') {
    return {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: { status: { type: Type.STRING, enum: ['ok'] } },
        required: ['status'],
      },
    };
  }
  return {
    responseMimeType: 'application/json',
    responseJsonSchema: {
      type: 'object',
      properties: { status: { type: 'string', enum: ['ok'] } },
      required: ['status'],
      additionalProperties: false,
    },
  };
}

function missingKeyRow(keySlot: KeySlot, model: string, test: DiagnosticTest): DiagnosticRow {
  return {
    keySlot,
    model,
    test,
    success: false,
    httpStatus: null,
    providerErrorCode: 'MISSING_KEY',
    categorizedResult: 'authentication',
  };
}

async function runTest(
  keySlot: KeySlot,
  apiKey: string | undefined,
  model: string,
  test: DiagnosticTest
): Promise<DiagnosticRow> {
  if (!apiKey) return missingKeyRow(keySlot, model, test);

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await withTimeout(
      ai.models.generateContent({
        model,
        contents: test === 'basic' ? 'Reply with the word OK.' : '{"status":"ok"}',
        ...(structuredConfig(test) ? { config: structuredConfig(test) } : {}),
      })
    );
    const text = response.text?.trim() ?? '';
    if (!text) {
      return {
        keySlot,
        model,
        test,
        success: false,
        httpStatus: null,
        providerErrorCode: null,
        categorizedResult: test === 'basic' ? 'unknown' : 'structured-output',
      };
    }
    if (test !== 'basic') {
      const parsed: unknown = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object' || (parsed as { status?: unknown }).status !== 'ok') {
        throw new Error('Structured response did not match diagnostic contract');
      }
    }
    return {
      keySlot,
      model,
      test,
      success: true,
      httpStatus: null,
      providerErrorCode: null,
      categorizedResult: 'success',
    };
  } catch (error) {
    const details = inspectGeminiError(error, test !== 'basic');
    const structuredFailure = test !== 'basic' && details.category === 'unknown';
    return {
      keySlot,
      model,
      test,
      success: false,
      httpStatus: details.httpStatus,
      providerErrorCode: details.providerErrorCode,
      categorizedResult: structuredFailure ? 'structured-output' : details.category,
    };
  }
}

async function main() {
  loadLocalEnvironment();
  const primaryKey = process.env.GEMINI_API_KEY_PRIMARY;
  const secondaryKey = process.env.GEMINI_API_KEY_SECONDARY;
  const configuredModel = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
  const models = process.env.GEMINI_DIAGNOSTIC_COMPARE === '1'
    ? [...new Set([configuredModel, 'gemini-2.5-flash'])]
    : [configuredModel];
  const keys: Array<[KeySlot, string | undefined]> = [
    ['primary', primaryKey],
    ['secondary', secondaryKey],
  ];
  const tests: DiagnosticTest[] = ['basic', 'responseSchema', 'responseJsonSchema'];
  const rows: DiagnosticRow[] = [];

  for (const [keySlot, apiKey] of keys) {
    for (const model of models) {
      for (const test of tests) rows.push(await runTest(keySlot, apiKey, model, test));
    }
  }

  console.table(rows);
}

void main().catch(() => {
  console.error('Gemini diagnostic failed before matrix completion.');
  process.exitCode = 1;
});

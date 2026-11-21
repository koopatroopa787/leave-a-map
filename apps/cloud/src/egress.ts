// apps/cloud/src/egress.ts: lane 3, the only code that sends anything to a model in the cloud.
// Input is a sender domain the person ticked; output is enums. Nothing from their mail is here.
//
// Firebase and App Check load only when the person clicks to look up ticked rows, never before.
// Cascade (BUILD-PLAN section 4): ask PREFER_ON_DEVICE first; re-ask ONLY_IN_CLOUD when the
// escalation rule fires; merge per field. Both models use the same cloud model name.
import { initializeApp, type FirebaseApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { getAI, getGenerativeModel, GoogleAIBackend, InferenceMode, Schema } from 'firebase/ai';
import { ACCOUNT_TYPES, BASIS, HOLDS, LOGIN_EMAIL_CHANGE, SERVICE_SCHEMA, parseServiceFields } from '../../../packages/core/contract.ts';
import { buildServicePrompt, escalationReason, mergeAnswers, SERVICE_SYSTEM_PROMPT, type Answer, type AnswerSource } from '../../../packages/core/cascade.ts';
import type { OutboxItem, ServiceInfo } from '../../../packages/core/handoff.ts';

export const CLOUD_MODEL = 'gemini-3.5-flash-lite';
const TEXT_EN = [{ type: 'text', languages: ['en'] }];

const env = import.meta.env;
const config = {
  apiKey: env.VITE_CLOUD_FIREBASE_API_KEY,
  authDomain: env.VITE_CLOUD_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_CLOUD_FIREBASE_PROJECT_ID,
  appId: env.VITE_CLOUD_FIREBASE_APP_ID,
};

/** The cloud schema, built with the SDK's helpers from the same enums as SERVICE_SCHEMA. */
const CLOUD_SCHEMA = Schema.object({
  properties: {
    basis: Schema.enumString({ enum: [...BASIS] }),
    category: Schema.enumString({ enum: [...ACCOUNT_TYPES] }),
    usuallyHolds: Schema.enumString({ enum: [...HOLDS] }),
    loginEmailChange: Schema.enumString({ enum: [...LOGIN_EMAIL_CHANGE] }),
  },
});

type Model = { generateContent(p: string): Promise<{ response: { text(): string; inferenceSource?: string } }> };
type Models = { first: Model; cloud: Model };
export type LookupLog = {
  id: string; first: AnswerSource; firstValid: boolean; escalation: string | null;
  second: { source: AnswerSource; valid: boolean; category?: string; basis?: string } | null; ms: number;
};

let models: Models | null = null;

function makeModels(app: FirebaseApp): Models {
  const ai = getAI(app, { backend: new GoogleAIBackend() });
  const inCloudParams = {
    model: CLOUD_MODEL,
    systemInstruction: SERVICE_SYSTEM_PROMPT,
    generationConfig: { responseMimeType: 'application/json', responseSchema: CLOUD_SCHEMA, temperature: 0 },
  };
  const first = getGenerativeModel(ai, {
    mode: InferenceMode.PREFER_ON_DEVICE,
    inCloudParams,
    onDeviceParams: {
      createOptions: {
        expectedInputs: TEXT_EN, expectedOutputs: TEXT_EN,
        // systemInstruction is not sent on-device, so the instructions go in the initial prompts.
        initialPrompts: [{ role: 'system', content: [{ type: 'text', value: SERVICE_SYSTEM_PROMPT }] }],
      },
      promptOptions: { responseConstraint: SERVICE_SCHEMA },
    },
  } as Parameters<typeof getGenerativeModel>[1]);
  const cloud = getGenerativeModel(ai, { mode: InferenceMode.ONLY_IN_CLOUD, inCloudParams } as Parameters<typeof getGenerativeModel>[1]);
  return { first, cloud };
}

/** Call from the consent click. Loads Firebase and App Check the first time only. */
export function initCloud(): Models {
  if (models) return models;
  if (!config.apiKey || !config.projectId || !config.appId || !env.VITE_CLOUD_RECAPTCHA_SITE_KEY) throw new Error('not-configured');
  // App Check debug token: local development only (`vite --mode debug`). Never in a production build.
  if (import.meta.env.DEV && env.VITE_CLOUD_APPCHECK_DEBUG_TOKEN) {
    (self as { FIREBASE_APPCHECK_DEBUG_TOKEN?: string }).FIREBASE_APPCHECK_DEBUG_TOKEN = env.VITE_CLOUD_APPCHECK_DEBUG_TOKEN;
  }
  const app = initializeApp(config, 'lane3');
  initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(env.VITE_CLOUD_RECAPTCHA_SITE_KEY), isTokenAutoRefreshEnabled: true });
  models = makeModels(app);
  return models;
}

/** Last failure per model kind, for the check page. Never includes the prompt or the answer. */
export const lastError: { first?: string; cloud?: string } = {};

async function ask(model: Model, domain: string, fallbackSource: AnswerSource, kind: 'first' | 'cloud'): Promise<Answer> {
  try {
    const { response } = await model.generateContent(buildServicePrompt(domain));
    const source: AnswerSource = response.inferenceSource === 'on_device' ? 'on_device' : response.inferenceSource === 'in_cloud' ? 'in_cloud' : fallbackSource;
    let parsed: unknown = null;
    try { parsed = JSON.parse(response.text()); } catch { lastError[kind] = 'reply was not JSON'; }
    const fields = parseServiceFields(parsed);
    if (!fields && parsed) lastError[kind] = 'reply had values outside the enums';
    return { fields, source };
  } catch (e) {
    lastError[kind] = String((e as Error)?.message ?? e).slice(0, 300);
    return { fields: null, source: fallbackSource };
  }
}

/** One domain through the cascade. Exported for the check page. */
export async function lookupOne(m: Models, item: OutboxItem, log?: (l: LookupLog) => void): Promise<ServiceInfo> {
  const started = performance.now();
  const first = await ask(m.first, item.senderDomain, 'on_device', 'first');
  // The rules' category hint never leaves the scan page (the outbox is { id, senderDomain } only),
  // so the disagreement rule can't fire here. The other three rules do.
  const escalation = escalationReason(first, null);
  const second = escalation ? await ask(m.cloud, item.senderDomain, 'in_cloud', 'cloud') : null;
  const merged = mergeAnswers(first, second, escalation, null);
  log?.({
    id: item.id, first: first.source, firstValid: !!first.fields, escalation,
    second: second ? { source: second.source, valid: !!second.fields, category: second.fields?.category, basis: second.fields?.basis } : null,
    ms: Math.round(performance.now() - started),
  });
  return { id: item.id, ...merged.fields, sources: merged.sources, escalation: merged.escalation };
}

/** Every approved domain, one at a time: the on-device model takes one prompt at a time anyway. */
export async function lookupAll(items: OutboxItem[], onProgress?: (done: number) => void, log?: (l: LookupLog) => void): Promise<ServiceInfo[]> {
  if (items.length === 0) return [];
  const m = initCloud();
  const out: ServiceInfo[] = [];
  for (const item of items) {
    out.push(await lookupOne(m, item, log));
    onProgress?.(out.length);
  }
  return out;
}

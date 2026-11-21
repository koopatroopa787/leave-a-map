// apps/scan/src/nano.ts: lane 2, Gemini Nano on the person's own mail. Runs in the window (the
// Prompt API isn't available in Workers) and never in the cloud.
import { initializeApp } from 'firebase/app';
import { getAI, getGenerativeModel, GoogleAIBackend, InferenceMode, InferenceSource } from 'firebase/ai';
import { LABEL_SCHEMA, SYSTEM_PROMPT, buildPrompt, parseLabel, type Label } from '../../../packages/core/contract.ts';

// Placeholder values on purpose. The scan site holds no real Firebase project, so even if a
// request escaped the CSP it could not authenticate to anything.
const NO_CLOUD_CONFIG = { apiKey: 'on-device-only', projectId: 'on-device-only', appId: '1:000000000000:web:0000000000000000' };

const TEXT_EN = [{ type: 'text' as const, languages: ['en'] }];
const CORE_OPTIONS = { expectedInputs: TEXT_EN, expectedOutputs: TEXT_EN };

export type NanoState = 'ready' | 'needs-download' | 'unavailable';
export type InferenceLog = { id: string; source: string; ms: number; valid: boolean };

type LanguageModelApi = { availability(o: unknown): Promise<string> };
const languageModel = () => (globalThis as { LanguageModel?: LanguageModelApi }).LanguageModel;

export async function probeNano(): Promise<NanoState> {
  const api = languageModel();
  if (!api) return 'unavailable';
  try {
    const state = await api.availability(CORE_OPTIONS);
    if (state === 'available') return 'ready';
    return state === 'unavailable' ? 'unavailable' : 'needs-download';
  } catch {
    return 'unavailable';
  }
}

/** Call from a click handler: downloading the model needs user activation. */
export async function startNano(onProgress: (loaded: number) => void, log: (entry: InferenceLog) => void): Promise<NanoClassifier> {
  // Required guard, firebase-js-sdk#10635: without LanguageModel the SDK ignores ONLY_ON_DEVICE
  // and sends the prompt to the cloud. Never build the model unless Nano is really there.
  if ((await probeNano()) === 'unavailable') throw new Error('nano-unavailable');
  const app = initializeApp(NO_CLOUD_CONFIG, 'scan-on-device');
  const ai = getAI(app, { backend: new GoogleAIBackend() });
  const model = getGenerativeModel(ai, {
    mode: InferenceMode.ONLY_ON_DEVICE,
    onDeviceParams: {
      createOptions: {
        ...CORE_OPTIONS,
        // systemInstruction is not sent on-device, so the instructions go in the initial prompts.
        initialPrompts: [{ role: 'system', content: [{ type: 'text', value: SYSTEM_PROMPT }] }],
      },
      promptOptions: { responseConstraint: LABEL_SCHEMA },
    },
  });
  await model.initializeDeviceModel(onProgress);
  return new NanoClassifier(model, log);
}

type Model = { generateContent(p: string): Promise<{ response: { text(): string; inferenceSource?: string } }> };

export class NanoClassifier {
  private tail: Promise<unknown> = Promise.resolve();
  private readonly model: Model;
  private readonly log: (entry: InferenceLog) => void;

  constructor(model: Model, log: (entry: InferenceLog) => void) {
    this.model = model;
    this.log = log;
  }

  /** One at a time: each SDK call replaces the previous session, which would abort a running prompt. */
  classify(id: string, senderDomain: string, preparedText: string): Promise<Label | null> {
    const run = () => this.once(id, senderDomain, preparedText);
    const result = this.tail.then(run, run);
    this.tail = result.catch(() => undefined);
    return result;
  }

  private async once(id: string, senderDomain: string, text: string): Promise<Label | null> {
    const started = performance.now();
    const { response } = await this.model.generateContent(buildPrompt(senderDomain, text));
    const source = response.inferenceSource ?? 'unknown';
    if (source !== InferenceSource.ON_DEVICE) throw new Error(`left the device: ${source}`);
    const label = parseLabel(response.text(), text);
    this.log({ id, source, ms: Math.round(performance.now() - started), valid: label !== null });
    return label;
  }
}

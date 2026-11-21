// apps/cloud/src/main.ts: T02 smoke call. One firebase/ai call behind App Check that prints
// inferenceSource. The consent window and the lane 3 cascade (T21, T22) replace this page.
import { initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { getAI, getGenerativeModel, GoogleAIBackend, InferenceMode } from 'firebase/ai';

const env = import.meta.env;
const config = {
  apiKey: env.VITE_CLOUD_FIREBASE_API_KEY,
  authDomain: env.VITE_CLOUD_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_CLOUD_FIREBASE_PROJECT_ID,
  appId: env.VITE_CLOUD_FIREBASE_APP_ID,
};
const CLOUD_MODEL = 'gemini-3.5-flash-lite';

const $ = (id: string) => document.getElementById(id)!;
const status = (t: string) => { $('status').textContent = t; };

async function run() {
  if (!config.apiKey || !config.projectId || !config.appId || !env.VITE_CLOUD_RECAPTCHA_SITE_KEY) {
    status('Not configured: copy .env.example to .env and fill in the Firebase web app values.');
    return;
  }
  // Debug token only for local and tonight's Gate B check. Set VITE_CLOUD_APPCHECK_DEBUG=1 at
  // build time; the token is printed in the console and registered in the Firebase console.
  if (env.VITE_CLOUD_APPCHECK_DEBUG === '1') (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = true;

  const app = initializeApp(config);
  initializeAppCheck(app, { provider: new ReCaptchaV3Provider(env.VITE_CLOUD_RECAPTCHA_SITE_KEY), isTokenAutoRefreshEnabled: true });
  const ai = getAI(app, { backend: new GoogleAIBackend() });
  const model = getGenerativeModel(ai, { mode: InferenceMode.ONLY_IN_CLOUD, inCloudParams: { model: CLOUD_MODEL } });

  status('Calling…');
  const started = performance.now();
  const result = await model.generateContent('Reply with the single word: ready');
  const ms = Math.round(performance.now() - started);
  const out = { text: result.response.text().trim(), inferenceSource: result.response.inferenceSource ?? 'unknown', ms, model: CLOUD_MODEL };
  console.log('smoke call', out);
  $('out').textContent = JSON.stringify(out, null, 2);
  status('Done.');
}

$('run').addEventListener('click', () => { run().catch((e) => { status(`Failed: ${e?.message ?? e}`); console.error(e); }); });

// apps/cloud/src/main.ts: T02 smoke call. One firebase/ai call behind App Check that prints
// inferenceSource. The consent window and the lane 3 cascade (T21, T22) replace this page.
import { initializeApp } from 'firebase/app';
import { getToken, initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
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
  // App Check debug token: local development only (`vite --mode debug`, reading the git-ignored
  // .env.debug). `import.meta.env.DEV` is false in every production build, so a deployed site can
  // never carry it.
  if (import.meta.env.DEV && env.VITE_CLOUD_APPCHECK_DEBUG_TOKEN) {
    (self as { FIREBASE_APPCHECK_DEBUG_TOKEN?: string }).FIREBASE_APPCHECK_DEBUG_TOKEN = env.VITE_CLOUD_APPCHECK_DEBUG_TOKEN;
  }

  const app = initializeApp(config);
  // reCAPTCHA Enterprise: the console marks classic v3 as deprecated, and the key is registered as Enterprise.
  const appCheck = initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(env.VITE_CLOUD_RECAPTCHA_SITE_KEY), isTokenAutoRefreshEnabled: true });
  // Show whether App Check issued a token. The token itself is never printed.
  const appCheckResult = await getToken(appCheck).then(() => 'token issued', (e: Error) => `no token (${e.message.slice(0, 120)})`);
  const ai = getAI(app, { backend: new GoogleAIBackend() });
  const model = getGenerativeModel(ai, { mode: InferenceMode.ONLY_IN_CLOUD, inCloudParams: { model: CLOUD_MODEL } });

  status('Calling…');
  const started = performance.now();
  const result = await model.generateContent('Reply with the single word: ready');
  const ms = Math.round(performance.now() - started);
  const out = { appCheck: appCheckResult, text: result.response.text().trim(), inferenceSource: result.response.inferenceSource ?? 'unknown', ms, model: CLOUD_MODEL };
  console.log('smoke call', out);
  $('out').textContent = JSON.stringify(out, null, 2);
  status('Done.');
}

$('run').addEventListener('click', () => { run().catch((e) => { status(`Failed: ${e?.message ?? e}`); console.error(e); }); });

// T24: says plainly what changes when Gemini Nano isn't available in this browser.
import { useEffect, useState } from 'preact/hooks';

export function NoAiBanner() {
  const [state, setState] = useState<string>('checking');
  useEffect(() => { import('../nano.ts').then((m) => m.probeNano()).then(setState, () => setState('unavailable')); }, []);
  if (state !== 'unavailable') return null;
  return (
    <p class="no-ai" role="status" id="no-ai-banner">
      <strong>On-device AI isn't available in this browser.</strong> The list comes from the rules alone, which
      are complete on their own. If you approve a cloud lookup, every answer comes from the cloud: on-device
      not available here → cloud.
    </p>
  );
}

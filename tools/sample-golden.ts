// tools/sample-golden.ts: runs the rules-only pipeline over the sample mailbox and prints, or
// writes, the golden file. Usage: node tools/sample-golden.ts [--write]
import { readFileSync, writeFileSync } from 'node:fs';
import { splitAllMessages } from '../packages/core/mbox/split.ts';
import { KEEP_BODY_BYTES, readBody } from '../packages/core/mbox/body.ts';
import { makeLinkContext } from '../packages/core/rules/school-link.ts';
import { Aggregator } from '../packages/core/rules/aggregate.ts';
import { rank } from '../packages/core/rank.ts';

import { SAMPLE_SETTINGS } from '../packages/core/sample.ts';

export async function sampleRulesOnly(bytes: Uint8Array) {
  const agg = new Aggregator(makeLinkContext(SAMPLE_SETTINGS.schoolDomain, SAMPLE_SETTINGS.ownAddresses));
  for (const m of splitAllMessages(bytes, 4096, KEEP_BODY_BYTES)) agg.add(m.rec, await readBody(m.raw));
  return rank(agg.accountsOut()).map((a) => ({ key: a.key, section: a.section, bucket: a.bucket, tier: a.primaryTier, discount: a.discount.tier, suspiciousIgnored: a.flags.suspiciousIgnored }));
}

if ((import.meta as { main?: boolean }).main) {
  const rows = await sampleRulesOnly(new Uint8Array(readFileSync('fixtures/sample.example.mbox')));
  if (process.argv.includes('--write')) {
    writeFileSync('fixtures/sample.expected.json', JSON.stringify({ settings: SAMPLE_SETTINGS, rulesOnly: rows }, null, 2) + '\n');
    console.log('wrote fixtures/sample.expected.json');
  } else for (const r of rows) console.log(`${r.section.padEnd(12)} ${r.bucket.padEnd(5)} ${String(r.tier).padEnd(8)} ${r.key}${r.discount ? ' [discount]' : ''}${r.suspiciousIgnored ? ` [${r.suspiciousIgnored} fake ignored]` : ''}`);
}

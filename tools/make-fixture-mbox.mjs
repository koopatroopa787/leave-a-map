// tools/make-fixture-mbox.mjs: writes a synthetic 200-message mailbox for Gate C and tests.
// Every name and domain is fictional (.example). Usage: node tools/make-fixture-mbox.mjs [out]
import { writeFileSync } from 'node:fs';

const out = process.argv[2] ?? 'fixtures/fixture-200.example.mbox';
const ME = 'jreyes@alderbrook.example';
let seed = 42;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = (a) => a[Math.floor(rnd() * a.length)];

const SERVICES = [
  ['Forkyard', 'mail.forkyard.example', ['Welcome to Forkyard', 'Your repository was starred', 'Security alert: new sign-in']],
  ['Quillbase', 'quillbase.example', ['Verify your email', 'Your project was shared with you', 'Compile finished']],
  ['Ledgerly', 'notify.ledgerly.example', ['Your monthly statement is ready', 'Payment received', 'Card on file updated']],
  ['Tunebox Student', 'tunebox.example', ['Your student plan renews soon', 'Receipt for your subscription']],
  ['Pagewell', 'news.pagewell.example', ['This week on Pagewell', 'Top stories for you'], true],
  ['Cartwheel', 'cartwheel.example', ['Your order has shipped', 'Receipt for order 4471']],
  ['Notewise', 'notewise.example', ['Reset your password', 'Your notes were backed up']],
  ['Alderbrook Registrar', 'registrar.alderbrook.example', ['Spring enrollment opens', 'Your transcript request']],
];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n) => String(n).padStart(2, '0');
const asctime = (d) => `${DAYS[d.getUTCDay()]} ${MONTHS[d.getUTCMonth()]} ${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} +0000 ${d.getUTCFullYear()}`;

const parts = [];
for (let i = 0; i < 200; i++) {
  const d = new Date(Date.UTC(2023, 0, 1) + Math.floor(rnd() * 3 * 365 * 86400e3));
  const kind = rnd();
  let from, subject, extra = [], to = ME;
  if (kind < 0.12) { from = `"Sam Ortiz" <sam@mailbox.example>`; subject = pick(['Lunch?', 'Notes from class', 'Re: group project']); }
  else if (kind < 0.18) { from = `"Mobile Bank" <alerts@mobilebank.example>`; subject = 'Login alert'; extra = ['X-Forwarded-For: j.reyes@personal.example ' + ME]; }
  else if (kind < 0.22) { from = `"Shop" <deals@shopfront.example>`; subject = 'Sale'; to = 'j.reyes@personal.example'; }
  else {
    const [name, domain, subjects, bulk] = pick(SERVICES);
    from = `"${name}" <no-reply@${domain}>`; subject = pick(subjects);
    if (bulk) extra = [`List-Unsubscribe: <mailto:unsubscribe@${domain}>`];
  }
  parts.push([
    `From ${1780000000000000000n + BigInt(i)}@xxx ${asctime(d)}`,
    `X-GM-THRID: ${1780000000000000000n + BigInt(i)}`,
    `Delivered-To: ${to}`,
    `From: ${from}`,
    `To: ${to}`,
    ...extra,
    `Subject: ${subject}`,
    `Date: ${d.toUTCString().replace('GMT', '+0000')}`,
    'Content-Type: text/plain; charset=UTF-8',
    '',
    `This is synthetic message ${i + 1}. It was made by tools/make-fixture-mbox.mjs.`,
    i % 17 === 0 ? '>From the archive: an escaped line.' : 'Nothing else here.',
    '',
  ].join('\n'));
}
writeFileSync(out, parts.join('\n'));
console.log(`wrote ${out}: 200 synthetic messages`);

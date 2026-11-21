// tools/make-fixture-mbox.mjs: writes a synthetic 200-message mailbox for Gate C and tests.
// Every name and domain is fictional (.example). Usage: node tools/make-fixture-mbox.mjs [out]
import { writeFileSync } from 'node:fs';

const out = process.argv[2] ?? 'fixtures/fixture-200.example.mbox';
const ME = 'jreyes@alderbrook.example';
let seed = 42;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = (a) => a[Math.floor(rnd() * a.length)];

// [name, sender domain, [[subject, body], ...], bulk?]
const SERVICES = [
  ['Forkyard', 'mail.forkyard.example', [['Welcome to Forkyard', 'Thanks for joining.'], ['Sam commented on your pull request', 'Looks good to me.'], ['Security alert: new sign-in', 'We noticed a new sign-in.']]],
  ['Quillbase', 'quillbase.example', [['Verify your email', 'Click the link below to verify your account.'], ['Your project was shared with you', 'Sam shared a project with you.'], ['Compile finished', 'Your document compiled.']]],
  ['Ledgerly', 'notify.ledgerly.example', [['Your monthly statement is ready', 'View it online.'], ['Payment received', 'We received $120.00. Card ending in 4242.']]],
  ['Tunebox Student', 'tunebox.example', [['Your student plan renews soon', 'You will be billed $5.99 on 1 June.'], ['Receipt for your subscription', 'Total: $5.99']]],
  ['Pagewell', 'news.pagewell.example', [['This week on Pagewell', 'Top stories.'], ['Top stories for you', 'More stories.']], true],
  ['Cartwheel', 'cartwheel.example', [['Your order has shipped', 'Order total $18.20'], ['Receipt for order 4471', 'Total: $18.20']]],
  ['Notewise', 'notewise.example', [['Reset your password', 'If you did not request this, ignore it.'], ['Account updated', 'Your recovery email is now jreyes@alderbrook.example.']]],
  ['Alderbrook Registrar', 'registrar.alderbrook.example', [['Spring enrollment opens', 'Enrol by March.'], ['Your transcript request', 'It is ready.']]],
];
const pass = (d) => `Authentication-Results: mx.google.com; dkim=pass header.i=@${d} header.s=s1 header.b=abc; spf=pass smtp.mailfrom=bounce@${d}; dmarc=pass (p=REJECT) header.from=${d}`;

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n) => String(n).padStart(2, '0');
const asctime = (d) => `${DAYS[d.getUTCDay()]} ${MONTHS[d.getUTCMonth()]} ${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} +0000 ${d.getUTCFullYear()}`;

const parts = [];
for (let i = 0; i < 200; i++) {
  const d = new Date(Date.UTC(2023, 0, 1) + Math.floor(rnd() * 3 * 365 * 86400e3));
  const kind = rnd();
  let from, subject, text = 'Nothing else here.', extra = [], to = ME;
  if (kind < 0.12) { from = `"Sam Ortiz" <sam@mailbox.example>`; subject = pick(['Lunch?', 'Notes from class', 'Re: group project']); }
  else if (kind < 0.16) { from = `"Mobile Bank" <alerts@mobilebank.example>`; subject = 'Login alert'; extra = ['X-Forwarded-For: j.reyes@personal.example ' + ME]; }
  else if (kind < 0.19) { from = `"Shop" <deals@shopfront.example>`; subject = 'Sale'; to = 'j.reyes@personal.example'; }
  else if (kind < 0.21) { from = `"Forkyard Support" <help@forkyard-security.example>`; subject = 'Verify your account now';
    extra = ['Authentication-Results: mx.google.com; spf=fail smtp.mailfrom=x@forkyard-security.example; dmarc=fail header.from=forkyard-security.example']; }
  else if (kind < 0.22) { from = `"Google" <no-reply@accounts.google.com>`; subject = 'Security alert';
    text = `Sketchpad Pro was granted access to your Google Account\n${ME}\nIf you did not grant access, check this activity.`; extra = [pass('accounts.google.com')]; }
  else {
    const [name, domain, items, bulk] = pick(SERVICES);
    const [s1, b1] = pick(items);
    from = `"${name}" <no-reply@${domain}>`; subject = s1; text = b1;
    extra = [pass(domain.split('.').slice(-2).join('.'))];
    if (bulk) extra.push(`List-Unsubscribe: <mailto:unsubscribe@${domain}>`);
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
    text,
    i % 17 === 0 ? '>From the archive: an escaped line.' : `Synthetic message ${i + 1}, made by tools/make-fixture-mbox.mjs.`,
    '',
  ].join('\n'));
}
writeFileSync(out, parts.join('\n'));
console.log(`wrote ${out}: 200 synthetic messages`);

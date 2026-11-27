// tools/make-estate-mbox.mjs: the sample mailbox for "Someone has died". One fictional person
// (Robin Hale) and their fictional bank, pension, insurer, bills, photo storage, password manager
// and shops, plus a family member's emails, a newsletter, a fake bank email and mail from the
// mailbox provider itself. Every person and service is fictional and ends in .example (RFC 2606).
// IPs are 192.0.2.0/24.
// Usage: node tools/make-estate-mbox.mjs [out]
import { writeFileSync } from 'node:fs';

const out = process.argv[2] ?? 'fixtures/estate.example.mbox';
const ME = 'robin.hale@mailbox.example';
const SISTER = 'jo.hale@mailbox.example';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n) => String(n).padStart(2, '0');
const asctime = (d) => `${DAYS[d.getUTCDay()]} ${MONTHS[d.getUTCMonth()]} ${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} +0000 ${d.getUTCFullYear()}`;
const rfc2822 = (d) => d.toUTCString().replace('GMT', '+0000');
const org = (domain) => domain.split('.').slice(-2).join('.');
const passAuth = (d) => `Authentication-Results: mx.mailbox.example;\n       dkim=pass header.i=@${org(d)} header.s=s1 header.b=AAAA;\n       spf=pass (mailbox.example: domain of bounce@${d} designates 192.0.2.10 as permitted sender) smtp.mailfrom=bounce@${d};\n       dmarc=pass (p=REJECT sp=REJECT dis=NONE) header.from=${org(d)}`;
const failAuth = (d) => `Authentication-Results: mx.mailbox.example;\n       dkim=none;\n       spf=softfail (mailbox.example: domain of transitioning bounce@${d} does not designate 192.0.2.66 as permitted sender) smtp.mailfrom=bounce@${d};\n       dmarc=fail (p=REJECT sp=REJECT dis=NONE) header.from=${org(d)}`;

function msg(n, { date, from, name, subject, body, bulk = false, auth = 'pass' }) {
  const d = new Date(`${date}T${pad(8 + (n % 10))}:${pad((n * 7) % 60)}:00Z`);
  const domain = from.split('@')[1];
  const thr = 1795000000000000000n + BigInt(n);
  return [
    `From ${thr}@xxx ${asctime(d)}`,
    `X-GM-THRID: ${thr}`,
    `X-Gmail-Labels: ${bulk ? 'Category Promotions,Inbox' : 'Inbox'}`,
    `Delivered-To: ${ME}`,
    `Received: from mail.${domain} (mail.${domain}. [192.0.2.${10 + (n % 200)}])\n        by mx.mailbox.example with ESMTPS id e${n}x\n        for <${ME}>;\n        ${rfc2822(d)}`,
    `Return-Path: <bounce@${domain}>`,
    auth === 'pass' ? passAuth(domain) : failAuth(domain),
    `Message-ID: <estate-${n}@${domain}>`,
    `Date: ${rfc2822(d)}`,
    `From: ${name ? `"${name}" ` : ''}<${from}>`,
    `To: ${ME}`,
    `Subject: ${subject}`,
    ...(bulk ? [`List-Unsubscribe: <mailto:unsubscribe@${domain}>`, 'Precedence: bulk'] : []),
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    '',
    `${body}\n\nEstate sample message ${n} of the Leave a Map sample mailbox. Fictional.`,
    '',
  ].join('\n');
}

const M = [];
const add = (o) => M.push(msg(M.length + 1, o));

// Money: bank, pension, life insurance, payments app, bills and subscriptions.
add({ date: '2019-04-02', from: 'hello@harbourline.example', name: 'Harbourline Bank', subject: 'Welcome to Harbourline Current Account',
  body: 'Welcome to Harbourline. Your current account is open.' });
add({ date: '2026-10-31', from: 'statements@harbourline.example', name: 'Harbourline Bank', subject: 'Your October statement is ready',
  body: 'Your October statement is ready. Sign in to view it.\n\nQuestions? Call us on 01632 960 112, Monday to Friday, or email help@harbourline.example.\nBereavement support: bereavement@harbourline.example or call 01632 960 113.\nHarbourline Bank, 4 Quay Row, Eastbury ZZ99 1HB.' });
add({ date: '2026-09-30', from: 'statements@oakmere-pensions.example', name: 'Oakmere Pensions', subject: 'Your annual statement is ready',
  body: 'Your annual pension statement is ready. Your pot value: £41,250.00.\n\nNeed help? Call 01632 960 214 or email members@oakmere-pensions.example.\nOakmere Pensions, Weir House, 9 Mill Lane, Westford ZZ99 2OP.' });
add({ date: '2026-03-14', from: 'policies@kestrelmutual.example', name: 'Kestrel Mutual', subject: 'Your annual statement for life policy KM-20417',
  body: 'Your annual statement for life policy KM-20417. Cover amount: £60,000.00. Your premium renews on 14 Mar 2027.\n\nTo make a claim, call 01632 960 330 or email claims@kestrelmutual.example.\nKestrel Mutual, 21 Harbour Street, Northam ZZ99 3KM.' });
add({ date: '2025-06-01', from: 'receipts@coinpurse.example', name: 'Coinpurse', subject: 'You sent £20.00 to Jo Hale',
  body: 'You sent £20.00 to Jo Hale. Receipt ID CP-88120.' });
add({ date: '2024-01-10', from: 'hello@brightwell-energy.example', name: 'Brightwell Energy', subject: 'Welcome to Brightwell Energy',
  body: 'Thanks for joining Brightwell Energy. Your account is ready.' });
add({ date: '2026-11-01', from: 'billing@brightwell-energy.example', name: 'Brightwell Energy', subject: 'Your bill is ready: £64.20',
  body: 'Your energy bill is £64.20. It will be taken by direct debit. Next payment date: 1 Dec.\n\nQuestions about your bill? Call 01632 960 450 or email help@brightwell-energy.example.\nBrightwell Energy, PO Box 77, Southby ZZ99 4BE.' });
add({ date: '2026-11-05', from: 'billing@fernway.example', name: 'Fernway Broadband', subject: 'Your monthly plan renewed',
  body: 'Your monthly plan renewed: £32.00. Payment taken from the card ending in 4417.\n\nHelp: support@fernway.example or phone 01632 960 518.' });
add({ date: '2022-02-20', from: 'hello@reelhouse.example', name: 'Reelhouse', subject: 'Welcome to Reelhouse',
  body: 'Welcome to Reelhouse. Your account is ready.' });
add({ date: '2026-11-08', from: 'billing@reelhouse.example', name: 'Reelhouse', subject: 'Your subscription renewed',
  body: 'Your subscription renewed: £10.99. Next billing date: 8 Dec.\n\nQuestions? Email help@reelhouse.example.' });
add({ date: '2026-10-12', from: 'billing@signalpoint.example', name: 'Signalpoint Mobile', subject: 'Your bill is ready: £18.00',
  body: 'Your mobile bill is ready: £18.00. Your plan renews each month. Next payment date: 12 Nov.\n\nCall 01632 960 607 from any phone, or email care@signalpoint.example.\nSignalpoint Mobile, 3 Tower Road, Easton ZZ99 6SM.' });
add({ date: '2021-05-05', from: 'hello@signalpoint.example', name: 'Signalpoint Mobile', subject: 'Welcome to Signalpoint',
  body: 'Welcome to Signalpoint. Your account has been created.' });

// Photos and files.
add({ date: '2020-08-15', from: 'hello@lumenbox.example', name: 'Lumenbox', subject: 'Welcome to Lumenbox',
  body: 'Welcome to Lumenbox. Your photo library is ready.' });
add({ date: '2026-07-21', from: 'notify@lumenbox.example', name: 'Lumenbox', subject: '42 files were added to the album "Garden 2026"',
  body: '42 files were added to the album "Garden 2026".' });
add({ date: '2026-05-02', from: 'notify@lumenbox.example', name: 'Lumenbox', subject: 'Jo shared the folder with you: "Family photos"',
  body: 'Jo shared the folder with you. Open "Family photos" to see it.' });
add({ date: '2023-11-11', from: 'team@inkwell.example', name: 'Inkwell Notes', subject: 'Welcome to Inkwell Notes',
  body: 'Thanks for signing up. Your notebook is ready.' });
add({ date: '2026-02-09', from: 'notify@inkwell.example', name: 'Inkwell Notes', subject: 'Jo commented on "Recipes"',
  body: 'Jo commented on your page "Recipes": "Add the lemon cake!"' });

// Can open other accounts: password manager.
add({ date: '2022-06-06', from: 'hello@latchvault.example', name: 'Latchvault', subject: 'Welcome to Latchvault: your vault is ready',
  body: `Welcome to Latchvault. Your password vault is ready.\n\n${ME} is your recovery email address.` });

// Shops, clubs and sites.
add({ date: '2025-12-03', from: 'orders@larkspur-books.example', name: 'Larkspur Books', subject: 'Order confirmation #LB-30981',
  body: 'Thanks for your order #LB-30981. Order total: £12.99.' });
add({ date: '2018-03-03', from: 'hello@thornfield-gardens.example', name: 'Thornfield Garden Club', subject: 'Welcome to Thornfield Garden Club',
  body: 'Welcome! Your membership account has been created.' });
add({ date: '2024-09-19', from: 'no-reply@murmur.example', name: 'Murmur', subject: 'Confirm your email address',
  body: 'Confirm your email address to finish creating your Murmur account.' });

// Health (flagged, not listed as an account to close).
add({ date: '2026-08-04', from: 'care@riverside-surgery.example', name: 'Riverside Surgery', subject: 'Appointment reminder: Tue 11 Aug, 09:40',
  body: 'This is a reminder of your appointment on Tue 11 Aug at 09:40. Sign in to the patient portal to change it.' });

// Newsletter only (maybe). A fake bank email (ignored). The mailbox provider (ends with the email).
add({ date: '2026-06-01', from: 'offers@wayfarer-travel.example', name: 'Wayfarer Travel', subject: 'Autumn breaks from £99', bulk: true,
  body: 'Autumn breaks from £99. Book by Sunday.' });
add({ date: '2026-11-03', from: 'alerts@harbourline-secure.example', name: 'Harbourline Bank', subject: 'Urgent: verify your account now', auth: 'fail',
  body: 'Your account is locked. Verify your account now or it will be closed.\n\nCall 01632 960 999 now or email unlock@harbourline-secure.example.' });
add({ date: '2026-10-02', from: 'accounts@mailbox.example', name: 'Mailbox', subject: 'Your storage is 90% full',
  body: 'Your Mailbox storage is 90% full. Upgrade your plan to keep receiving email.' });

// Family: person-to-person mail is skipped by the scan.
add({ date: '2026-10-20', from: SISTER, name: 'Jo Hale', subject: 'Sunday lunch?',
  body: 'Are you still up for Sunday? I can bring the cake.' });

writeFileSync(out, M.join('\n'));
console.log(`wrote ${out}: ${M.length} messages`);

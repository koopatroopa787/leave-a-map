// tools/make-sample-mbox.mjs: the "Try the sample" mailbox (analyst.md section 3). 52 messages,
// one fictional student (Jordan Reyes, Alderbrook University), 24 fictional services, every
// ranking case and every trap, plus one message from each of 3 held-out domains that stay out of
// the pack so lane 3 has something to look up.
//
// Every person and service is fictional and ends in .example (RFC 2606), except the 3 held-out
// domains: real non-profit research sites, so the cloud lookup can recognise something real.
// IPs are 192.0.2.0/24.
// Usage: node tools/make-sample-mbox.mjs [--held-out a,b,c] [out]
//
// HELD_OUT (Gate 1, decision 1): arxiv.org, zenodo.org and openreview.net. All three are run by
// non-profits and none is in the move pack (checked by tests/unit/pack.test.ts). The plan's
// fallback, if either of us says no, is fictional domains: pass
// --held-out openscholar.example,datavault.example,loanhub.example and regenerate.
import { writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const hi = args.indexOf('--held-out');
const HELD_OUT = hi >= 0 ? args.splice(hi, 2)[1].split(',') : ['arxiv.org', 'zenodo.org', 'openreview.net'];
const out = args[0] ?? 'fixtures/sample.example.mbox';

const ME = 'jordan.reyes@alderbrook.example';
const ALIAS = 'jreyes@alderbrook.example';
const PERSONAL = 'jordanr@tidemail.example';
const SAM = 'sam.okafor@tidemail.example';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n) => String(n).padStart(2, '0');
const asctime = (d) => `${DAYS[d.getUTCDay()]} ${MONTHS[d.getUTCMonth()]} ${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} +0000 ${d.getUTCFullYear()}`;
const rfc2822 = (d) => d.toUTCString().replace('GMT', '+0000');
const org = (domain) => domain.split('.').slice(-2).join('.');

const passAuth = (d) => `Authentication-Results: mx.google.com;\n       dkim=pass header.i=@${org(d)} header.s=s1 header.b=AAAA;\n       spf=pass (google.com: domain of bounce@${d} designates 192.0.2.10 as permitted sender) smtp.mailfrom=bounce@${d};\n       dmarc=pass (p=REJECT sp=REJECT dis=NONE) header.from=${org(d)}`;
const failAuth = (d) => `Authentication-Results: mx.google.com;\n       dkim=none;\n       spf=softfail (google.com: domain of transitioning bounce@${d} does not designate 192.0.2.66 as permitted sender) smtp.mailfrom=bounce@${d};\n       dmarc=fail (p=REJECT sp=REJECT dis=NONE) header.from=${org(d)}`;

/**
 * One message. link: DT (Delivered-To own address), DTa (alias), RF (Received ... for only),
 * FW (auto-forwarded from the personal mailbox).
 */
function msg(n, { date, from, name, link = 'DT', subject, body, bulk = false, auth = 'pass', html = null, to, extra = [] }) {
  const d = new Date(`${date}T${pad(8 + (n % 10))}:${pad((n * 7) % 60)}:00Z`);
  const domain = from.split('@')[1];
  const thr = 1790000000000000000n + BigInt(n);
  const deliveredTo = link === 'DTa' ? ALIAS : link === 'RF' ? null : ME;
  const toLine = to ?? (link === 'RF' ? 'undisclosed-recipients:;' : link === 'FW' ? PERSONAL : link === 'DTa' ? ALIAS : ME);
  const received = `Received: from mail.${domain} (mail.${domain}. [192.0.2.${10 + (n % 200)}])\n        by mx.google.com with ESMTPS id s${n}x\n        for <${link === 'FW' ? ME : deliveredTo ?? ME}>;\n        ${rfc2822(d)}`;
  const headers = [
    `From ${thr}@xxx ${asctime(d)}`,
    `X-GM-THRID: ${thr}`,
    `X-Gmail-Labels: ${bulk ? 'Category Promotions,Inbox' : 'Inbox'}`,
    ...(deliveredTo ? [`Delivered-To: ${deliveredTo}`] : []),
    received,
    ...(link === 'FW' ? [`X-Forwarded-For: ${PERSONAL} ${ME}`, `X-Forwarded-To: ${ME}`,
      `Return-Path: <jordanr+caf_=jordan.reyes=alderbrook.example@tidemail.example>`] : [`Return-Path: <bounce@${domain}>`]),
    auth === 'pass' ? passAuth(domain) : failAuth(domain),
    `Message-ID: <sample-${n}@${domain}>`,
    `Date: ${rfc2822(d)}`,
    `From: ${name ? `"${name}" ` : ''}<${from}>`,
    `To: ${toLine}`,
    `Subject: ${subject}`,
    ...(bulk ? [`List-Unsubscribe: <mailto:unsubscribe@${domain}>`, 'Precedence: bulk'] : []),
    ...extra,
    'MIME-Version: 1.0',
  ];
  const text = `${body}\n\nSample message ${n} of the Leave a Map sample mailbox. Fictional.`;
  if (!html) return [...headers, 'Content-Type: text/plain; charset=UTF-8', '', text, ''].join('\n');
  const b = `b${n}sample`;
  return [...headers, `Content-Type: multipart/alternative; boundary="${b}"`, '',
    `--${b}`, 'Content-Type: text/plain; charset=UTF-8', '', text, '',
    `--${b}`, 'Content-Type: text/html; charset=UTF-8', '', html, '', `--${b}--`, ''].join('\n');
}

const M = [];
const add = (o) => M.push(msg(M.length + 1, o));

// 1–4 Forkyard: school-login notice, SSO welcome to the alias, strong work, security.
add({ date: '2023-09-04', from: 'no-reply@sso.alderbrook.example', name: 'Alderbrook Sign-in', subject: 'Security alert',
  body: `Forkyard was granted access to your Alderbrook account\n${ME}\n\nIf you did not grant access, review the apps connected to your account.` });
add({ date: '2023-09-04', from: 'hello@forkyard.example', name: 'Forkyard', link: 'DTa', subject: 'Welcome to Forkyard',
  body: 'Thanks for creating your Forkyard account. You signed up with your Alderbrook school account, so you sign in with Alderbrook.' });
add({ date: '2025-02-11', from: 'notifications@forkyard.example', name: 'Forkyard', subject: '[thesis-sim] Pull request #14 merged',
  body: 'Your pull request #14 "Add Monte Carlo runner" was merged into main in the repository thesis-sim.' });
add({ date: '2026-05-20', from: 'security@forkyard.example', name: 'Forkyard', subject: 'New sign-in to your Forkyard account',
  body: 'We noticed a new sign-in to your Forkyard account from a new device. If this was you, there is nothing to do.' });
// 5–6 Notebloom: SSO welcome, share.
add({ date: '2023-10-01', from: 'team@notebloom.example', name: 'Notebloom', subject: 'Welcome to Notebloom',
  body: 'Welcome! You signed up using your school account. Your workspace is ready.' });
add({ date: '2026-03-03', from: 'notify@notebloom.example', name: 'Notebloom', subject: 'Priya shared the page "Lab 4 notes" with you',
  body: 'Priya shared the page "Lab 4 notes" with you. You can edit it.' });
// 7–10 Proofwright.
add({ date: '2024-01-15', from: 'no-reply@proofwright.example', name: 'Proofwright', subject: 'Confirm your email address',
  body: 'Confirm your email address to finish creating your Proofwright account. Your code is 4F7-K2Q.' });
add({ date: '2024-01-15', from: 'hello@proofwright.example', name: 'Proofwright', subject: 'Welcome to Proofwright',
  body: 'Welcome to Proofwright. Your password has been set and your account is ready.' });
add({ date: '2025-11-12', from: 'notify@proofwright.example', name: 'Proofwright', subject: 'Alex invited you to edit "Thesis - final"',
  body: 'Alex invited you to edit the project "Thesis - final".' });
add({ date: '2026-04-02', from: 'notify@proofwright.example', name: 'Proofwright', subject: 'Your project "Thesis - final" compiled with 3 warnings',
  body: 'Your project "Thesis - final" compiled with 3 warnings.' });
// 11–14 Sketchloom: student plan, comment, student check, promo (bulk trap).
add({ date: '2024-02-01', from: 'billing@sketchloom.example', name: 'Sketchloom', subject: 'Your student plan is active',
  body: 'Your Sketchloom student plan is active until you graduate. Amount charged: $0.00. Your plan renews each year while you are a student.' });
add({ date: '2025-06-10', from: 'notify@sketchloom.example', name: 'Sketchloom', subject: 'Sam commented on "Poster v3"',
  body: 'Sam commented on your design "Poster v3": "Love the colours."' });
add({ date: '2026-08-01', from: 'billing@sketchloom.example', name: 'Sketchloom', subject: 'Student status check: your student plan ends when you graduate',
  body: 'We need to verify your student status. Your student plan ends when you graduate.' });
add({ date: '2026-09-15', from: 'news@sketchloom.example', name: 'Sketchloom', subject: 'Go Pro: 30% off for teams', bulk: true,
  body: 'Upgrade to Pro today and save 30% on team plans.' });
// 15–16 Stowbin.
add({ date: '2023-08-20', from: 'no-reply@stowbin.example', name: 'Stowbin', subject: 'Reset your Stowbin password',
  body: 'We received a request to reset the password for your Stowbin account. If you did not ask, ignore this email.' });
add({ date: '2025-12-01', from: 'notify@stowbin.example', name: 'Stowbin', subject: '3 files were added to the folder "Fieldwork photos"',
  body: '3 files were added to the folder "Fieldwork photos".' });
// 17–19 Learnridge and Citewell: one transactional each (Nano cases), one bulk.
add({ date: '2026-06-30', from: 'no-reply@learnridge.example', name: 'Learnridge', subject: 'Your certificate for Intro to Statistics is ready',
  body: 'Congratulations! Your certificate for Intro to Statistics is ready to download from your Learnridge dashboard.' });
add({ date: '2026-09-01', from: 'news@learnridge.example', name: 'Learnridge', subject: 'New courses this autumn', bulk: true,
  body: 'Browse our new courses this autumn.' });
add({ date: '2026-02-14', from: 'sync@citewell.example', name: 'Citewell', subject: 'Your library synced: 214 references',
  body: 'Your Citewell library synced across your devices: 214 references in 6 collections.' });
// 20–21 Tidemail: recovery address, security.
add({ date: '2022-08-30', from: 'accounts@tidemail.example', name: 'Tidemail', subject: 'Recovery email added',
  body: `${ME} is now the recovery address for ${PERSONAL}. We'll use it if you ever need to reset your password.` });
add({ date: '2026-10-10', from: 'security@tidemail.example', name: 'Tidemail', subject: 'Security alert: new sign-in to your Tidemail account',
  body: 'There was a new sign-in to your Tidemail account. We sent this alert to your recovery email.' });
// 22–23 Latchkin.
add({ date: '2024-05-05', from: 'hello@latchkin.example', name: 'Latchkin', subject: 'Welcome to Latchkin: your vault is ready',
  body: 'Welcome to Latchkin. Your password vault is ready. Keep your master password safe.' });
add({ date: '2026-05-05', from: 'billing@latchkin.example', name: 'Latchkin', subject: 'Your Latchkin plan renewed',
  body: 'Your Latchkin plan renewed: $3.00. Next billing date: 5 May 2027.' });
// 24–26 Brightpenny: welcome, statement, spoof.
add({ date: '2023-08-25', from: 'hello@brightpenny.example', name: 'Brightpenny', subject: 'Welcome to Brightpenny Checking',
  body: 'Welcome to Brightpenny Checking. Your account is open.' });
add({ date: '2026-10-31', from: 'statements@brightpenny.example', name: 'Brightpenny', subject: 'Your October statement is ready',
  body: 'Your October statement is ready. Sign in to view it.' });
add({ date: '2026-11-02', from: 'alerts@brightpenny.example', name: 'Brightpenny', subject: 'Urgent: verify your account now', auth: 'fail',
  body: 'Your account is locked. Verify your account now or it will be closed.' });
// 27–28 Paywisp.
add({ date: '2024-09-09', from: 'no-reply@paywisp.example', name: 'Paywisp', subject: 'Confirm your email for Paywisp',
  body: 'Confirm your email to start sending money with Paywisp.' });
add({ date: '2026-07-19', from: 'receipts@paywisp.example', name: 'Paywisp', subject: 'You sent $12.50 to Sam Okafor',
  body: 'You sent $12.50 to Sam Okafor.\nReceipt ID PW-2213.\n\nThis receipt was sent to j*****@alderbrook.example.' });
// 29–30 Tunefield.
add({ date: '2024-08-15', from: 'billing@tunefield.example', name: 'Tunefield', subject: 'Verify your student status by 1 Aug',
  body: 'Keep your student discount: verify your student status by 1 Aug.' });
add({ date: '2026-10-05', from: 'billing@tunefield.example', name: 'Tunefield', subject: 'Your Student plan renewed',
  body: 'Your Student plan renewed: $5.99. Next billing date: 5 Nov. Student discount applied.' });
// 31–32 Mendwise (health).
add({ date: '2026-04-11', from: 'care@mendwise.example', name: 'Mendwise', subject: 'Appointment reminder: Thu 16 Apr, 10:30',
  body: 'This is a reminder of your appointment on Thu 16 Apr at 10:30. Sign in to the patient portal to reschedule.' });
add({ date: '2026-04-20', from: 'care@mendwise.example', name: 'Mendwise', subject: 'Your test results are available in the patient portal',
  body: 'Your test results are available. Sign in to the patient portal to view them.' });
// 33–34 Chirpline.
add({ date: '2026-01-22', from: 'notify@chirpline.example', name: 'Chirpline', subject: 'Sam mentioned you in a post',
  body: 'Sam mentioned you in a post: "Great talk today @jordan".' });
add({ date: '2026-07-01', from: 'digest@chirpline.example', name: 'Chirpline', subject: 'Your weekly digest', bulk: true,
  body: 'Here is what you missed this week.' });
// 35–37 Parcelpine: order with schema.org markup, shipped, deals.
add({ date: '2025-03-03', from: 'orders@parcelpine.example', name: 'Parcelpine', subject: 'Order confirmation #PP-48213',
  body: 'Thanks for your order #PP-48213. Order total: $24.99.',
  html: '<html><body><script type="application/ld+json">{"@context":"http://schema.org","@type":"Order","merchant":{"@type":"Organization","name":"Parcelpine"},"orderNumber":"PP-48213","priceCurrency":"USD","price":"24.99"}</script><p>Thanks for your order #PP-48213. Order total: $24.99.</p></body></html>' });
add({ date: '2025-03-05', from: 'ship@parcelpine.example', name: 'Parcelpine', subject: 'Your order #PP-48213 has shipped',
  body: 'Your order #PP-48213 has shipped.' });
add({ date: '2026-08-20', from: 'deals@parcelpine.example', name: 'Parcelpine', subject: 'Weekend deals', bulk: true,
  body: 'Deals for the weekend.' });
// 38–39 Munchroute: one receipt linked only by Received ... for.
add({ date: '2024-11-08', from: 'receipts@munchroute.example', name: 'Munchroute', subject: 'Your receipt from Munchroute: $18.40',
  body: 'Thanks for ordering. Total: $18.40.' });
add({ date: '2026-02-02', from: 'receipts@munchroute.example', name: 'Munchroute', link: 'RF', subject: 'Your receipt from Munchroute: $9.10',
  body: 'Thanks for ordering. Total: $9.10.' });
// 40 Tallyquiz (ambiguous). 41–42 Vistaroam (bulk only).
add({ date: '2025-05-05', from: 'hello@tallyquiz.example', name: 'Tallyquiz', subject: 'Your quiz results for STAT 210 practice set',
  body: 'You scored 8 out of 10 on the STAT 210 practice set.' });
add({ date: '2026-03-12', from: 'offers@vistaroam.example', name: 'Vistaroam', subject: 'Flash sale: fares for students', bulk: true,
  body: 'Flash sale on fares for students this week only.' });
add({ date: '2026-06-12', from: 'offers@vistaroam.example', name: 'Vistaroam', subject: 'Last chance: summer trips', bulk: true,
  body: 'Last chance to book summer trips.' });
// 43–44 Pixelquay: auto-forwarded from the personal mailbox.
add({ date: '2025-07-07', from: 'welcome@pixelquay.example', name: 'Pixelquay', link: 'FW', subject: 'Welcome to Pixelquay',
  body: 'Welcome to Pixelquay! Your account is ready.' });
add({ date: '2025-07-07', from: 'no-reply@pixelquay.example', name: 'Pixelquay', link: 'FW', subject: 'Verify your Pixelquay email',
  body: 'Verify your email to start playing.' });
// 45 Sam forwards Hireloft's welcome (manual forward trap).
add({ date: '2026-02-18', from: SAM, name: 'Sam Okafor', subject: 'Fwd: Welcome to Hireloft',
  body: `thought you'd like this site for jobs\n\n---------- Forwarded message ---------\nFrom: Hireloft <hello@hireloft.example>\nTo: ${SAM}\nSubject: Welcome to Hireloft\n\n> Welcome to Hireloft, Sam! Your account is ready.` });
// 46–47 Lookalikes.
add({ date: '2026-05-01', from: 'security@notebIoom.example', name: 'Notebloom', subject: 'Your workspace will be deleted: verify now',
  body: 'Your Notebloom workspace will be deleted in 24 hours. Verify your password now to keep it.' });
add({ date: '2026-06-06', from: 'alert@forkyard-verify.example', name: 'Forkyard Security', subject: 'Unusual sign-in: confirm your password',
  body: 'We detected an unusual sign-in. Confirm your password to keep your Forkyard account.' });
// 48–52 School-run mail (ends anyway).
add({ date: '2026-09-02', from: 'no-reply@learn.alderbrook.example', name: 'Alderbrook Learn', subject: 'Assignment graded: STAT 210',
  body: 'Your assignment for STAT 210 has been graded.' });
add({ date: '2026-10-14', from: 'no-reply@learn.alderbrook.example', name: 'Alderbrook Learn', subject: 'New announcement in ENGL 101',
  body: 'There is a new announcement in ENGL 101.' });
add({ date: '2026-09-20', from: 'robotics@lists.alderbrook.example', name: 'Robotics Club', subject: 'Robotics club: meeting Thursday',
  to: 'robotics@lists.alderbrook.example', extra: ['List-Id: Robotics Club <robotics.lists.alderbrook.example>'],
  body: 'We meet Thursday at 6 in the lab.' });
add({ date: '2026-10-01', from: 'editor@quad.alderbrook.example', name: 'The Daily Quad', subject: 'The Daily Quad: October issue', bulk: true,
  body: 'The October issue is out.' });
add({ date: '2026-10-20', from: 'registrar@alderbrook.example', name: 'Alderbrook Registrar', subject: 'Your Alderbrook email closes on 31 Mar 2027',
  body: 'Your Alderbrook email account will close on 31 Mar 2027. Move anything you need before then.' });

if (M.length !== 52) throw new Error(`expected 52 messages, made ${M.length}`);

// 53–55: the held-out domains, one transactional message each. Kept out of the pack (T28).
const HELD_SUBJECTS = [
  ['Your submission was announced', 'Your article "Monte Carlo methods for small samples" was announced today.'],
  ['Your upload is published', 'Your upload "Fieldwork photos 2025" is now published.'],
  ['Your profile changes were saved', 'The changes to your profile were saved. Sign in to review them.'],
];
HELD_OUT.forEach((d, i) => add({ date: `2026-0${7 + i}-1${i}`, from: `no-reply@${d}`, subject: HELD_SUBJECTS[i][0], body: HELD_SUBJECTS[i][1] }));

writeFileSync(out, M.join('\n'));
console.log(`wrote ${out}: ${M.length} messages (52 + ${HELD_OUT.length} held-out: ${HELD_OUT.join(', ')})`);

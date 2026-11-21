// tools/make-nano-sample.mjs: a mailbox of 60 fictional services (2 emails each) in many kinds,
// written like real service mail, for measuring Nano (U2). Every name and domain is fictional.
// Usage: node tools/make-nano-sample.mjs [out]
import { writeFileSync } from 'node:fs';

const out = process.argv[2] ?? 'fixtures/nano-sample-60.example.mbox';
const ME = 'jreyes@alderbrook.example';
const KINDS = {
  'code host': [['[thesis-code] Sam commented on pull request #14', 'Sam left a comment on your pull request: "Can you add tests for the parser?" Reply to this email or view it on the website.'],
    ['Your repository was forked', 'Your repository thesis-code was forked by 3 people this week.']],
  'document editor': [['Dr. Ames shared "Lab report draft" with you', 'Dr. Ames invited you to edit the document "Lab report draft". Open it to start editing.'],
    ['Your files were backed up', 'All 214 files in your workspace were backed up on 3 March.']],
  'LaTeX editor': [['Compile finished: thesis.tex', 'Your project "Thesis" compiled with 2 warnings. Your collaborators can see the new PDF.'],
    ['Jordan joined your project', 'Jordan accepted your invitation to collaborate on "Thesis".']],
  'design tool': [['New comment on "Poster v3"', 'Priya commented on your design: "Make the title bigger." 4 people can view this file.'],
    ['Your trial ends in 3 days', 'Keep your 12 designs by choosing the education plan before your trial ends.']],
  bank: [['Your monthly statement is ready', 'Your statement for the checking account ending 4471 is ready. Closing balance: $1,204.10.'],
    ['Deposit received', 'A deposit of $850.00 was added to your account ending 4471.']],
  'payment app': [['You paid Sam $12.50', 'You sent $12.50 to Sam for "Lunch". Your balance is $40.20.'],
    ['New device signed in', 'Your account was used to sign in on a new phone. If this was not you, reset your password.']],
  'password manager': [['Your vault was accessed from a new browser', 'Your password vault with 86 saved logins was unlocked on a new browser.'],
    ['Emergency access request', 'A trusted contact requested emergency access to your vault.']],
  'phone carrier': [['Your bill is ready', 'Your phone bill of $35.00 is ready. Autopay will charge your card ending 0912 on 5 April.'],
    ['Your number transfer PIN', 'You asked for a number transfer PIN. Your PIN is 4821. Never share it.']],
  'music streaming': [['Your student plan renews soon', 'Your student plan renews on 1 June for $5.99. Verify your student status to keep the discount.'],
    ['Your year in music', 'You listened to 12,400 minutes this year. See your top songs.']],
  'online store': [['Your order has shipped', 'Order 1193 is on its way. Total charged: $48.20 to your card ending 0912.'],
    ['Rate your purchase', 'How was the desk lamp you bought last week? Leave a review.']],
  'news site': [['Top stories this week', 'Five stories we think you will like. Unsubscribe at any time.'],
    ['Weekend reading', 'Long reads for your weekend. You are receiving this because you subscribed.']],
  'social network': [['Sam mentioned you in a post', 'Sam mentioned you: "Great talk today!" See the post and reply.'],
    ['You have 3 new followers', '3 people followed you this week.']],
  clinic: [['Appointment reminder', 'Your appointment is on 4 April at 10:30. Log in to the patient portal to see your test results.'],
    ['New message from your care team', 'Your care team sent you a message in the patient portal.']],
  'course platform': [['Assignment graded: Essay 2', 'Your essay was graded. Open the course page to see feedback.'],
    ['Certificate ready', 'Your certificate for "Intro to Statistics" is ready to download.']],
  'cloud storage': [['Your storage is almost full', 'You are using 14.6 GB of 15 GB. Your photos and documents may stop syncing.'],
    ['Shared folder updated', 'Priya added 6 files to the shared folder "Field data".']],
};
const PREFIX = ['Fork', 'Quill', 'Ledger', 'Tune', 'Page', 'Cart', 'Note', 'Vault', 'Signal', 'Tally', 'Pixel', 'Grove', 'Mint', 'Orbit', 'Ember', 'Harbor', 'Atlas', 'Cobalt', 'Lumen', 'Pebble'];
const SUFFIX = ['yard', 'base', 'ly', 'box', 'well', 'wheel', 'wise', 'kit', 'hub', 'nest', 'loop', 'craft'];
const kinds = Object.keys(KINDS);
let t = Date.UTC(2025, 0, 6);
const pad = (n) => String(n).padStart(2, '0');
const D = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const parts = [];
const answers = [];
for (let i = 0; i < 60; i++) {
  const kind = kinds[i % kinds.length];
  const name = PREFIX[i % PREFIX.length] + SUFFIX[(i * 7) % SUFFIX.length];
  const domain = `${name.toLowerCase()}${i}.example`;
  answers.push({ domain, kind });
  for (const [subject, body] of KINDS[kind]) {
    t += 3600e3 * 17;
    const d = new Date(t);
    const bulk = kind === 'news site';
    parts.push([`From ${i}@xxx ${D[d.getUTCDay()]} ${M[d.getUTCMonth()]} ${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:00:00 +0000 ${d.getUTCFullYear()}`,
      `Delivered-To: ${ME}`, `From: "${name}" <no-reply@${domain}>`, `To: ${ME}`,
      `Authentication-Results: mx.google.com; dkim=pass header.i=@${domain}; spf=pass smtp.mailfrom=b@${domain}; dmarc=pass header.from=${domain}`,
      ...(bulk ? [`List-Unsubscribe: <mailto:u@${domain}>`] : []),
      `Subject: ${subject}`, `Date: ${d.toUTCString().replace('GMT', '+0000')}`, 'Content-Type: text/plain; charset=utf-8', '',
      `Hi Jordan,\n\n${body}\n\nThe ${name} team`, ''].join('\n'));
  }
}
writeFileSync(out, parts.join('\n'));
writeFileSync(out.replace(/\.mbox$/, '.kinds.json'), JSON.stringify(answers, null, 1));
console.log(`wrote ${out}: ${parts.length} emails from 60 fictional services`);

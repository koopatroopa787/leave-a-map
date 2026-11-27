// apps/scan/src/export-steps.ts: how to get an .mbox file out of each kind of mailbox, step by step,
// for the "How do I get this file?" guide on the start screen. Written for someone who has never
// done this: each step says which account it means, and a second line says what to expect.
// Checked 27 Nov 2026. Outlook only exports .pst and Yahoo has no export, so those go through
// Thunderbird, which keeps mail as mbox.
import type { Mode } from './mode.ts';

export type Provider = 'gmail' | 'apple' | 'outlook' | 'other';
export type Step = { text: string; detail?: string; link?: { href: string; label: string } };
export type Guide = { label: string; note?: string; intro?: string; steps: Step[]; after?: string };

/** Which mailbox the steps are about, in words, for each mode. */
const MAILBOX: Record<Mode, { it: string; short: string }> = {
  school: { it: 'the email address that’s closing (the one you want Leave a Map to check)', short: 'the address that’s closing' },
  loss: { it: 'the email address you’ve been given access to (the one you want Leave a Map to check)', short: 'that address' },
};

const choose: Step = { text: 'Come back to this page and click "Choose a file" in step 3. Pick the file from the last step.', detail: 'Leave a Map reads it on this computer. It isn’t uploaded anywhere.' };

function thunderbird(m: { it: string; short: string }, provider: string): Step[] {
  return [
    { text: 'On a computer, download Thunderbird, a free email app made by a non-profit.', link: { href: 'https://www.thunderbird.net/', label: 'thunderbird.net' },
      detail: 'Click the big Download button on that page. The file goes to your Downloads folder.' },
    { text: 'Install it.', detail: 'Windows: open the downloaded file and click Yes, then Next until it finishes. Mac: open the downloaded file and drag the Thunderbird icon into the Applications folder.' },
    { text: `Open Thunderbird. In the "Set up your existing email address" window, type your name, ${m.it}, and its password. Click Continue, then Done.`,
      detail: `If a ${provider} sign-in window opens, sign in there with ${m.short}. Thunderbird only stores the mail on this computer.` },
    { text: 'Wait until all the mail has downloaded. Leave Thunderbird open.',
      detail: 'Click Inbox on the left. When the bottom of the window stops saying "Downloading", it’s done. A big mailbox can take an hour or more.' },
    { text: 'Add the free export tool: click the menu button (three lines, top right), then "Add-ons and Themes".',
      detail: 'In the search box, type ImportExportTools NG and press Enter. Click "Add to Thunderbird", then "Add". If it asks to restart, click Restart.' },
    { text: `In the list on the left, find Inbox under ${m.short} and right-click it.`, detail: 'On a Mac without a right button, hold the Control key and click.' },
    { text: 'Choose "ImportExportTools NG", then "Export folder". Pick Desktop as the place to save it.',
      detail: 'A file named "Inbox" appears on your Desktop. It has nothing after the name, no .mbox. That’s normal and it’s the right file.' },
    choose,
  ];
}

export function guides(mode: Mode): Record<Provider, Guide> {
  const m = MAILBOX[mode];
  return {
    gmail: {
      label: 'Gmail',
      note: 'Also school or work email run by Google (the sign-in page shows the Google logo).',
      steps: [
        { text: 'On a computer, not a phone, open Google Takeout.', link: { href: 'https://takeout.google.com/', label: 'takeout.google.com' },
          detail: 'Takeout is Google’s own free page for downloading a copy of your data.' },
        { text: `Sign in with ${m.it}.`,
          detail: `If another Google account is already signed in, click the round picture in the top-right corner and switch to ${m.short}, or choose "Add another account".` },
        { text: 'Click "Deselect all" near the top of the list.', detail: 'Google lists everything it can save, all ticked. You only need email, so untick everything first.' },
        { text: 'Scroll down to "Mail" and tick its box.', detail: 'The list is in alphabetical order. Leave every other box empty.' },
        { text: 'Scroll to the very bottom and click "Next step".' },
        { text: 'Leave the choices as they are and click "Create export".', detail: 'They say: send the download link by email, export once, as a .zip file. That’s what you want.' },
        { text: `Wait for an email from Google saying your data is ready. It arrives in ${m.short}.`,
          detail: 'It can take a few hours, or a day or two for a big mailbox. You can close the page and come back.' },
        { text: 'Open that email and click "Download your files".', detail: 'Google may ask for the password again. The file goes to your Downloads folder.' },
        { text: 'Open the downloaded .zip file.', detail: 'Windows: right-click it, choose "Extract All", then "Extract". Mac: double-click it. A folder named Takeout appears.' },
        { text: 'Open the Takeout folder, then Mail. Find the file whose name ends in .mbox.', detail: 'It’s usually called "All mail Including Spam and Trash.mbox". It can be large; that’s normal.' },
        choose,
      ],
      after: 'School or work account and Takeout says it’s turned off? The IT team can switch it off. Use the steps under "Yahoo, AOL or other" instead, or ask the IT team for an export.',
    },
    apple: {
      label: 'iCloud or Apple Mail',
      note: 'Any email account set up in the Mail app on a Mac (the stamp icon).',
      steps: [
        { text: `On a Mac, open the Mail app and check that ${m.short} is listed in the sidebar on the left.`,
          detail: 'Not there? Open System Settings, click Internet Accounts, then Add Account, and sign in with it.' },
        { text: 'Wait until the mail has finished downloading.', detail: 'Click Inbox. When new messages stop appearing, it’s done.' },
        { text: `In the sidebar, click Inbox under ${m.short}.` },
        { text: 'At the top of the screen, click the Mailbox menu, then "Export Mailbox".', detail: 'Pick Desktop as the place to save it and click Choose.' },
        { text: 'On your Desktop, open the new folder whose name ends in .mbox.', detail: 'Inside is a file named just "mbox". That’s the one.' },
        choose,
      ],
      after: 'Each mailbox is exported on its own. Start with Inbox; you can run Leave a Map again on another one, like Archive.',
    },
    outlook: {
      label: 'Outlook or Hotmail',
      note: 'Also Live, MSN and Microsoft 365 school or work email.',
      intro: 'Outlook’s own export makes a .pst file, which Leave a Map can’t read. The free Thunderbird app can make the right kind of file instead:',
      steps: thunderbird(m, 'Microsoft'),
    },
    other: {
      label: 'Yahoo, AOL or other',
      note: 'Most providers that let an email app sign in.',
      intro: 'Most providers can’t export the right kind of file themselves. The free Thunderbird app can:',
      steps: thunderbird(m, 'provider’s'),
    },
  };
}

export const PROVIDERS: Provider[] = ['gmail', 'apple', 'outlook', 'other'];

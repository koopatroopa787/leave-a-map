// apps/scan/src/export-steps.ts: how to get an .mbox file out of each kind of mailbox, step by step,
// for the "How do I get this file?" guide on the start screen. Checked 27 Nov 2026. Outlook only
// exports .pst and Yahoo has no export, so those go through Thunderbird, which keeps mail as mbox.
export type Provider = 'gmail' | 'apple' | 'outlook' | 'other';
export type Step = { text: string; link?: { href: string; label: string } };
export type Guide = { label: string; note?: string; intro?: string; steps: Step[]; after?: string };

const THUNDERBIRD: Step[] = [
  { text: 'Install Thunderbird, a free email app, on a computer.', link: { href: 'https://www.thunderbird.net/', label: 'thunderbird.net' } },
  { text: 'Open it and add the account: type the email address and password, then sign in when the provider asks.' },
  { text: 'Wait until all the mail has downloaded. A large mailbox can take an hour or more. Leave Thunderbird open.' },
  { text: 'Open the menu (☰), choose Add-ons and Themes, search for "ImportExportTools NG" and click Add to Thunderbird.' },
  { text: 'Right-click Inbox in the folder list and choose ImportExportTools NG, then Export Folder. Save it somewhere easy to find, like Desktop.' },
  { text: 'You get a file named "Inbox" with nothing after the name. That\'s the one: choose it in step 3.' },
];

export const GUIDES: Record<Provider, Guide> = {
  gmail: {
    label: 'Gmail',
    note: 'Also school or work accounts run by Google.',
    steps: [
      { text: 'On a computer, go to Google Takeout and sign in to the account.', link: { href: 'https://takeout.google.com/', label: 'takeout.google.com' } },
      { text: 'Click "Deselect all". Then scroll down to Mail and tick it.' },
      { text: 'Scroll to the bottom and click "Next step". Leave the choices as they are (send download link by email, export once, .zip) and click "Create export".' },
      { text: 'Wait for Google\'s email saying the export is ready. It can take a few hours, or a day or two for a big mailbox.' },
      { text: 'Download the .zip from that email and open it.' },
      { text: 'Inside, open Takeout, then Mail. The file ending in .mbox (often "All mail Including Spam and Trash.mbox") is the one: choose it in step 3.' },
    ],
    after: 'School or work account and Takeout says it\'s turned off? The IT team can switch it off. Use the steps under "Other" instead, or ask them for an export.',
  },
  apple: {
    label: 'iCloud or Apple Mail',
    note: 'Any account in the Mail app on a Mac.',
    steps: [
      { text: 'On a Mac, open the Mail app. If the account isn\'t there yet, add it in System Settings, then Internet Accounts.' },
      { text: 'Wait until the mail has finished downloading.' },
      { text: 'In the sidebar, click Inbox under the account.' },
      { text: 'From the menu bar, choose Mailbox, then Export Mailbox. Pick a folder, like Desktop, and click Choose.' },
      { text: 'You get a folder ending in .mbox. Open it: the file inside named "mbox" is the one. Choose it in step 3.' },
    ],
    after: 'Each mailbox is exported on its own. Start with Inbox; you can run Leave a Map again on another one, like Archive.',
  },
  outlook: {
    label: 'Outlook or Hotmail',
    note: 'Also Live, MSN and Microsoft 365 school or work accounts.',
    intro: 'Outlook\'s own export makes a .pst file, which Leave a Map can\'t read. The free Thunderbird app can make the right kind of file instead:',
    steps: THUNDERBIRD,
  },
  other: {
    label: 'Yahoo, AOL or other',
    note: 'Most providers that let an email app sign in.',
    intro: 'Most providers can\'t export the right kind of file themselves. The free Thunderbird app can:',
    steps: THUNDERBIRD,
  },
};

export const PROVIDERS = Object.keys(GUIDES) as Provider[];

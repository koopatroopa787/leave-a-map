// packages/core/rules/patterns.ts: service-mail patterns (analyst.md 1.4 and 1.5). English only.
// S = subject, B = body text. All are estimates, tuned against real mailboxes in T10's check.

export const P = {
  WELCOME_S: /\b(?:welcome to|welcome aboard|thanks? (?:you )?for (?:signing up|joining|registering|creating)|your (?:new )?account (?:has been|is|was) (?:created|ready|set up|activated)|you(?:'re| are) (?:in|all set|now a member))\b/i,
  WELCOME_B: /\byou(?:'ve| have) (?:successfully )?(?:created|registered|signed up)|\byour account (?:was|has been) created|\bfinish (?:setting up|creating) your account|\bcomplete your (?:profile|registration)\b/i,
  VERIFY_S: /\b(?:verify|confirm|activate|validate)\b.{0,30}\b(?:e-?mail|address|account|registration|sign-?up)\b|\b(?:verification|confirmation|activation|one-time|security|login|sign-?in) code\b|\byour code\b/i,
  VERIFY_B: /\b(?:click|tap) (?:the|this) (?:link|button)(?: below)? to (?:verify|confirm|activate)\b|\b(?:code|otp)(?: is|:)\s*[A-Z0-9-]{4,10}\b|\bexpires in \d+ (?:minutes|hours)\b/i,
  RESET_S: /\b(?:reset|change|recover|forgot)\b.{0,20}\bpassword\b|\bpassword (?:reset|change|changed|updated|recovery)\b|\baccount recovery\b/i,
  RESET_B: /\b(?:reset|choose|create) (?:a |your )?new password\b|\bif you did(?:n't| not) request (?:this|a password reset)\b|\bforgot your password\b/i,
  SECURITY_S: /\bnew (?:sign-?in|login|device)\b|\bsigned in (?:from|on) a new\b|\bunusual (?:sign-?in|activity)\b|\bsecurity alert\b/i,
  RECEIPT_S: /\b(?:receipt|invoice|order (?:confirmation|confirmed|#|no\.?|number)|your order|payment (?:received|confirmation|successful|processed)|thanks? (?:you )?for your (?:order|purchase|payment)|you (?:sent|paid|received)\b)/i,
  AMOUNT: /(?:[$€£₹¥]|\b(?:USD|EUR|GBP|INR|CAD|AUD)\b)\s?\d{1,3}(?:[,\s]\d{3})*(?:\.\d{2})?/,
  RECURRING: /\b(?:renew(?:s|ed|al)|next (?:billing|payment) date|billed (?:monthly|annually|yearly)|auto-?renew|subscription (?:renewed|confirmed|confirmation)|your (?:monthly|annual) plan)\b/i,
  CARD_ON_FILE: /\b(?:card ending(?: in)?|ending in \d{4}|card on file|saved card|payment method (?:added|updated))\b/i,
  STATEMENT_S: /\bstatement (?:is ready|is available|for)\b|\byour (?:monthly|annual) statement\b|\b(?:balance|deposit|transfer) (?:alert|received|update)\b|\byou sent [$€£]?\d[\d,]*(?:\.\d{2})? to\b/i,
  // A password manager can open every other account, so it ranks with the recovery addresses.
  PASSWORD_MANAGER: /\bpassword (?:vault|manager)\b/i,
  RECOVERY_B: /\b(?:recovery|backup|secondary) (?:e-?mail|address)\b/i,
  WORK_STRONG: /\b(?:repositor(?:y|ies)|pull request|merge request|commit(?:ted)?|shared (?:a |the )?(?:file|folder|document|doc|page|project|board|design|notebook) with you|invited you to (?:edit|collaborate|join|comment)|commented on|mentioned you in (?:a )?(?:comment|doc|page|file))\b/i,
  WORK_WEAK: /\b(?:project|workspace|document|folder|files? (?:were|was) (?:added|uploaded)|draft|manuscript|compiled|notebook|board)\b/i,
  STUDENT_DISCOUNT: /\b(?:student (?:discount|plan|pricing|membership|offer|tier|status|verification|checking|account)|education(?:al)? (?:plan|pricing|discount|licen[cs]e)|academic (?:plan|pricing|discount|licen[cs]e)|verify (?:your )?student status|for students)\b/i,
  HEALTH: /\b(?:appointment|test results?|lab results?|prescription|clinic|patient portal|telehealth|your (?:doctor|provider|care team))\b/i,
  SSO_WELCOME: /\b(?:signed (?:up|in)|registered|logged in|created your account|joined) (?:with|using|via|through) (?:your )?(?:google|microsoft|school|university|institution(?:al)?|campus|sso|single sign-on|office 365|microsoft 365)(?: account)?\b/i,
  // NO-PASSWORD HINT (analyst.md 2.3): the service says the account has no password of its own,
  // which is how school-login accounts look. Possible only: it never moves a card on its own.
  NO_PASSWORD: /\b(?:you (?:don't|do not|didn't|did not) (?:have|set|create) a password|(?:your account|you) (?:has|have) no password|no password (?:is )?(?:needed|required|set)|(?:add|create|set) a password (?:to|for|on) your account)\b/i,
} as const;

/** Phrases in a service's own mail that hint the account uses school login (BUILD-PLAN section 4). */
export const SSO_PHRASE = /\b(?:signed up with google|continue with google|sign in with microsoft)\b/i;

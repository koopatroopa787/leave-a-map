// apps/scan/src/words.ts: counts in sentences, so one email reads "1 email", not "1 emails".
export const emails = (n: number) => `${n.toLocaleString()} ${n === 1 ? 'email' : 'emails'}`;

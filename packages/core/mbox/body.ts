// packages/core/mbox/body.ts: the text the rules read from one message (analyst.md 1.0, step 2).
import PostalMime from 'postal-mime';

export type BodyInfo = {
  /** Plain text (or HTML with tags stripped), whitespace collapsed, first 4,000 characters. */
  text: string;
  /** Gmail email markup for an order, invoice or parcel (RECEIPT signal). */
  orderMarkup: boolean;
};

export const TEXT_MAX = 4000;
/** Raw bytes kept per message while streaming. Enough for the text part of nearly all mail. */
export const KEEP_BODY_BYTES = 96 * 1024;

const ORDER_MARKUP = /"@type"\s*:\s*"(?:Order|Invoice|ParcelDelivery)"|itemtype="https?:\/\/schema\.org\/(?:Order|Invoice|ParcelDelivery)"/;
const ENTITIES: Record<string, string> = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'" };

export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|head)\b[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(?:p|div|tr|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+|#39);/gi, (m, e: string) => {
      const k = e.toLowerCase();
      if (ENTITIES[k]) return ENTITIES[k];
      if (k.startsWith('#x')) return String.fromCodePoint(parseInt(k.slice(2), 16) || 32);
      if (k.startsWith('#')) return String.fromCodePoint(parseInt(k.slice(1), 10) || 32);
      return m;
    });
}

export const collapse = (s: string) => s.replace(/[​-‍﻿­]/g, '').replace(/\s+/g, ' ').trim();

export const EMPTY_BODY: BodyInfo = { text: '', orderMarkup: false };

/** Never throws: a message postal-mime can't read just has no body text. */
export async function readBody(raw: Uint8Array | null): Promise<BodyInfo> {
  if (!raw || raw.length === 0) return EMPTY_BODY;
  try {
    const email = await PostalMime.parse(raw, { attachmentEncoding: 'base64', maxRfc822NestingDepth: 2 });
    const html = email.html ?? '';
    const plain = email.text && email.text.trim() ? email.text : htmlToText(html);
    return { text: collapse(plain).slice(0, TEXT_MAX), orderMarkup: ORDER_MARKUP.test(html) };
  } catch {
    return EMPTY_BODY;
  }
}

// packages/core/mbox/split.ts: streams an .mbox file into message records, a chunk at a time.
// Memory stays flat: each message keeps its headers (up to 256 KB) and, if asked, the first
// `keepBodyBytes` of its body. The rest is skipped and can be re-read later by byte offset.
import type { MessageRecord } from '../types.ts';
import { parseHeaderBlock } from './headers.ts';

const NL = 0x0a;
const CR = 0x0d;
const GT = 0x3e;
const HEAD_MAX = 200; // bytes of each line kept to test for a separator
const HEADER_MAX = 256 * 1024;

/**
 * A separator is an asctime-style "From " line, as written by Takeout-style, Apple Mail and
 * Thunderbird exports: `From <sender> Sat Nov 21 10:00:00 [+0000] 2026`. Body lines that
 * start with "From " are escaped as ">From " by mboxrd writers, and the date pattern keeps
 * most unescaped body lines from splitting a message.
 */
const SEPARATOR_RE =
  /^From \S+\s+(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\s+\d{1,2}:\d{2}/;
const ESCAPED_FROM_RE = /^>+From /;

/** A message record plus its raw bytes (headers, blank line, capped body), or null when bodies aren't kept. */
export type SplitMessage = { rec: MessageRecord; raw: Uint8Array | null; truncated: boolean };

type Current = {
  start: number; bodyStart: number; inHeaders: boolean;
  headerParts: Uint8Array[]; headerBytes: number;
  bodyParts: Uint8Array[]; bodyBytes: number; truncated: boolean;
};

const concat = (parts: Uint8Array[], size: number) => {
  const out = new Uint8Array(size);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
};

export class MboxSplitter {
  private pos = 0;
  private lineStart = 0;
  private lineLen = 0;
  private readonly head = new Uint8Array(HEAD_MAX);
  private headLen = 0;
  private lineParts: Uint8Array[] = [];
  private collecting = false;
  private cur: Current | null = null;
  private index = 0;
  private readonly latin1 = new TextDecoder('latin1');
  private readonly keepBody: number;

  /** Bytes seen before the first separator. More than a few means this isn't an mbox file. */
  leadingBytes = 0;

  constructor(opts: { keepBodyBytes?: number } = {}) {
    this.keepBody = opts.keepBodyBytes ?? 0;
  }

  /** Records only. */
  push(chunk: Uint8Array): MessageRecord[] {
    return this.pushMessages(chunk).map((m) => m.rec);
  }

  end(): MessageRecord[] {
    return this.endMessages().map((m) => m.rec);
  }

  /** Records with their raw bytes, for body parsing. */
  pushMessages(chunk: Uint8Array): SplitMessage[] {
    const out: SplitMessage[] = [];
    let i = 0;
    while (i < chunk.length) {
      if (this.lineLen === 0 && this.headLen === 0) this.collecting = this.wantsLine();
      const nl = chunk.indexOf(NL, i);
      const segEnd = nl === -1 ? chunk.length : nl;
      if (this.headLen < HEAD_MAX) {
        const take = Math.min(HEAD_MAX - this.headLen, segEnd - i);
        this.head.set(chunk.subarray(i, i + take), this.headLen);
        this.headLen += take;
      }
      this.lineLen += segEnd - i;
      if (this.collecting) this.lineParts.push(chunk.slice(i, nl === -1 ? segEnd : nl + 1));
      if (nl === -1) break;
      this.endLine(this.pos + nl + 1, out);
      i = nl + 1;
    }
    this.pos += chunk.length;
    return out;
  }

  endMessages(): SplitMessage[] {
    const out: SplitMessage[] = [];
    if (this.lineLen > 0 || this.lineParts.length > 0) this.endLine(this.pos, out);
    this.finish(this.pos, out);
    return out;
  }

  private wantsLine(): boolean {
    const c = this.cur;
    if (!c) return false;
    if (c.inHeaders) return c.headerBytes < HEADER_MAX || this.keepBody > 0;
    if (c.bodyBytes < this.keepBody) return true;
    c.truncated = true;
    return false;
  }

  private endLine(next: number, out: SplitMessage[]) {
    const head = this.head.subarray(0, this.headLen);
    const blank = this.lineLen === 0 || (this.lineLen === 1 && head[0] === CR);
    const isSeparator = head[0] === 0x46 && head[4] === 0x20 && SEPARATOR_RE.test(this.latin1.decode(head));
    const c = this.cur;

    if (isSeparator) {
      this.finish(this.lineStart, out);
      this.cur = { start: this.lineStart, bodyStart: -1, inHeaders: true, headerParts: [], headerBytes: 0,
        bodyParts: [], bodyBytes: 0, truncated: false };
    } else if (c?.inHeaders) {
      if (blank) {
        c.inHeaders = false;
        c.bodyStart = next;
        if (this.keepBody > 0) this.addBody(c);
      } else if (c.headerBytes < HEADER_MAX) {
        for (const p of this.lineParts) { c.headerParts.push(p); c.headerBytes += p.length; }
      }
    } else if (c) {
      if (this.lineParts.length > 0) {
        // mboxrd: ">From " in a body was written for "From "; drop one ">".
        if (head[0] === GT && ESCAPED_FROM_RE.test(this.latin1.decode(head))) this.lineParts[0] = this.lineParts[0].subarray(1);
        this.addBody(c);
      }
    } else {
      this.leadingBytes = next;
    }

    this.lineParts = [];
    this.headLen = 0;
    this.lineLen = 0;
    this.lineStart = next;
  }

  private addBody(c: Current) {
    for (const p of this.lineParts) { c.bodyParts.push(p); c.bodyBytes += p.length; }
  }

  private finish(end: number, out: SplitMessage[]) {
    const c = this.cur;
    if (!c) return;
    this.cur = null;
    const header = concat(c.headerParts, c.headerBytes);
    const rec: MessageRecord = { index: this.index++, start: c.start, bodyStart: c.bodyStart < 0 ? end : c.bodyStart, end,
      ...parseHeaderBlock(header) };
    const raw = this.keepBody > 0 ? concat([header, ...c.bodyParts], c.headerBytes + c.bodyBytes) : null;
    out.push({ rec, raw, truncated: c.truncated });
  }
}

/** Convenience for tests and small files: split a whole buffer, optionally in chunks of `chunkSize`. */
export function splitAll(bytes: Uint8Array, chunkSize = bytes.length || 1): MessageRecord[] {
  return splitAllMessages(bytes, chunkSize).map((m) => m.rec);
}

export function splitAllMessages(bytes: Uint8Array, chunkSize = bytes.length || 1, keepBodyBytes = 0): SplitMessage[] {
  const s = new MboxSplitter({ keepBodyBytes });
  const out: SplitMessage[] = [];
  for (let i = 0; i < bytes.length; i += chunkSize) out.push(...s.pushMessages(bytes.subarray(i, i + chunkSize)));
  out.push(...s.endMessages());
  return out;
}

/** Turns the bytes between a record's `start` and `end` (read later with `File.slice`) back into one message. */
export function messageFromSlice(slice: Uint8Array): Uint8Array {
  const first = slice.indexOf(NL);
  const body = first === -1 ? new Uint8Array(0) : slice.subarray(first + 1);
  const latin1 = new TextDecoder('latin1');
  const parts: Uint8Array[] = [];
  let size = 0;
  for (let i = 0; i < body.length;) {
    const nl = body.indexOf(NL, i);
    const end = nl === -1 ? body.length : nl + 1;
    let line = body.subarray(i, end);
    if (line[0] === GT && ESCAPED_FROM_RE.test(latin1.decode(line.subarray(0, 40)))) line = line.subarray(1);
    parts.push(line);
    size += line.length;
    i = end;
  }
  return concat(parts, size);
}

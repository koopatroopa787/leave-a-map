// packages/core/mbox/split.ts: streams an .mbox file into message records, a chunk at a time.
// Only header bytes are kept in memory; bodies are skipped and can be re-read by byte offset.
import type { MessageRecord } from '../types.ts';
import { parseHeaderBlock } from './headers.ts';

const NL = 0x0a;
const CR = 0x0d;
const HEAD_MAX = 200; // bytes of each line kept to test for a separator
const HEADER_MAX = 256 * 1024; // header bytes kept per message; the rest are skipped

/**
 * A separator is an asctime-style "From " line, as written by Takeout-style, Apple Mail and
 * Thunderbird exports: `From <sender> Sat Nov 21 10:00:00 [+0000] 2026`. Body lines that
 * start with "From " are escaped as ">From " by mboxrd writers, and the date pattern keeps
 * most unescaped body lines from splitting a message.
 */
const SEPARATOR_RE =
  /^From \S+\s+(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\s+\d{1,2}:\d{2}/;

type Current = { start: number; bodyStart: number; parts: Uint8Array[]; bytes: number; inHeaders: boolean };

export class MboxSplitter {
  private pos = 0;
  private lineStart = 0;
  private lineLen = 0;
  private readonly head = new Uint8Array(HEAD_MAX);
  private headLen = 0;
  private lineParts: Uint8Array[] = [];
  private cur: Current | null = null;
  private index = 0;
  private readonly latin1 = new TextDecoder('latin1');

  /** Bytes seen before the first separator. More than a few means this isn't an mbox file. */
  leadingBytes = 0;

  push(chunk: Uint8Array): MessageRecord[] {
    const out: MessageRecord[] = [];
    let i = 0;
    while (i < chunk.length) {
      const nl = chunk.indexOf(NL, i);
      const segEnd = nl === -1 ? chunk.length : nl;
      if (this.headLen < HEAD_MAX) {
        const take = Math.min(HEAD_MAX - this.headLen, segEnd - i);
        this.head.set(chunk.subarray(i, i + take), this.headLen);
        this.headLen += take;
      }
      this.lineLen += segEnd - i;
      if (this.cur?.inHeaders && this.cur.bytes < HEADER_MAX) {
        this.lineParts.push(chunk.slice(i, nl === -1 ? segEnd : nl + 1));
      }
      if (nl === -1) break;
      this.endLine(this.pos + nl + 1, out);
      i = nl + 1;
    }
    this.pos += chunk.length;
    return out;
  }

  /** Call once after the last chunk. */
  end(): MessageRecord[] {
    const out: MessageRecord[] = [];
    if (this.lineLen > 0) this.endLine(this.pos, out);
    this.finish(this.pos, out);
    return out;
  }

  private endLine(next: number, out: MessageRecord[]) {
    const head = this.head.subarray(0, this.headLen);
    const blank = this.lineLen === 0 || (this.lineLen === 1 && head[0] === CR);
    const isSeparator = head[0] === 0x46 && head[4] === 0x20 && SEPARATOR_RE.test(this.latin1.decode(head));

    if (isSeparator) {
      this.finish(this.lineStart, out);
      this.cur = { start: this.lineStart, bodyStart: -1, parts: [], bytes: 0, inHeaders: true };
    } else if (this.cur?.inHeaders) {
      if (blank) {
        this.cur.inHeaders = false;
        this.cur.bodyStart = next;
      } else {
        for (const p of this.lineParts) { this.cur.parts.push(p); this.cur.bytes += p.length; }
      }
    } else if (!this.cur) {
      this.leadingBytes = next;
    }

    this.lineParts = [];
    this.headLen = 0;
    this.lineLen = 0;
    this.lineStart = next;
  }

  private finish(end: number, out: MessageRecord[]) {
    const c = this.cur;
    if (!c) return;
    this.cur = null;
    const block = new Uint8Array(c.bytes);
    let o = 0;
    for (const p of c.parts) { block.set(p, o); o += p.length; }
    out.push({ index: this.index++, start: c.start, bodyStart: c.bodyStart < 0 ? end : c.bodyStart, end,
      ...parseHeaderBlock(block) });
  }
}

/** Convenience for tests and small files: split a whole buffer, optionally in chunks of `chunkSize`. */
export function splitAll(bytes: Uint8Array, chunkSize = bytes.length || 1): MessageRecord[] {
  const s = new MboxSplitter();
  const out: MessageRecord[] = [];
  for (let i = 0; i < bytes.length; i += chunkSize) out.push(...s.push(bytes.subarray(i, i + chunkSize)));
  out.push(...s.end());
  return out;
}

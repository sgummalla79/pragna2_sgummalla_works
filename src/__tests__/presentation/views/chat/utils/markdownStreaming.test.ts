import { describe, expect, it } from 'vitest';
import { normalizeMathDelimiters } from '@/presentation/views/chat/utils/markdownStreaming';

describe('normalizeMathDelimiters', () => {
  it('converts inline \\( … \\) to $ … $', () => {
    expect(normalizeMathDelimiters('a \\(x^2\\) b')).toBe('a $x^2$ b');
  });

  it('converts display \\[ … \\] to $$ … $$', () => {
    expect(normalizeMathDelimiters('\\[E = mc^2\\]')).toBe('$$E = mc^2$$');
  });

  it('converts multiple math spans in one string', () => {
    expect(normalizeMathDelimiters('\\(a\\) then \\[b\\]')).toBe('$a$ then $$b$$');
  });

  it('leaves existing $ / $$ delimiters untouched', () => {
    expect(normalizeMathDelimiters('inline $a$ and $$b$$')).toBe(
      'inline $a$ and $$b$$',
    );
  });

  it('does not rewrite \\( inside an inline code span', () => {
    expect(normalizeMathDelimiters('use `\\(x\\)` literally')).toBe(
      'use `\\(x\\)` literally',
    );
  });

  it('does not rewrite math delimiters inside a fenced code block', () => {
    const src = '```\n\\[not math\\]\n```';
    expect(normalizeMathDelimiters(src)).toBe(src);
  });

  it('rewrites math outside a code block but not inside it', () => {
    const src = 'before \\(a\\)\n```\n\\(b\\)\n```\nafter \\[c\\]';
    expect(normalizeMathDelimiters(src)).toBe(
      'before $a$\n```\n\\(b\\)\n```\nafter $$c$$',
    );
  });

  it('returns an empty string unchanged', () => {
    expect(normalizeMathDelimiters('')).toBe('');
  });

  it('leaves plain prose with no math untouched', () => {
    expect(normalizeMathDelimiters('just text, no math here')).toBe(
      'just text, no math here',
    );
  });
});

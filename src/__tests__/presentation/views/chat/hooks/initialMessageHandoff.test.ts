import { describe, it, expect, beforeEach } from 'vitest';
import {
  INITIAL_MESSAGE_STORAGE_KEY,
  consumePendingInitialMessage,
  hasPendingInitialMessage,
  peekPendingInitialMessage,
  writePendingInitialMessage,
} from '@/presentation/views/chat/hooks/initialMessageHandoff';

describe('initialMessageHandoff', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  describe('round-trip', () => {
    it('writes and reads a {text, agent} pair', () => {
      writePendingInitialMessage('conv-1', {
        text: 'Hello Pragna',
        agent: 'research-pipeline',
      });

      const peeked = peekPendingInitialMessage('conv-1');
      expect(peeked).toEqual({ text: 'Hello Pragna', agent: 'research-pipeline' });
    });

    it('peek leaves the value in storage; consume removes it', () => {
      writePendingInitialMessage('conv-1', { text: 'Hi', agent: 'default' });

      expect(peekPendingInitialMessage('conv-1')).not.toBeNull();
      expect(peekPendingInitialMessage('conv-1')).not.toBeNull();

      const consumed = consumePendingInitialMessage('conv-1');
      expect(consumed).toEqual({ text: 'Hi', agent: 'default' });
      // Second consume — already removed.
      expect(consumePendingInitialMessage('conv-1')).toBeNull();
      expect(peekPendingInitialMessage('conv-1')).toBeNull();
    });

    it('hasPendingInitialMessage tracks presence non-destructively', () => {
      expect(hasPendingInitialMessage('conv-1')).toBe(false);
      writePendingInitialMessage('conv-1', { text: 'x', agent: 'default' });
      expect(hasPendingInitialMessage('conv-1')).toBe(true);
      // Still present after the check.
      expect(hasPendingInitialMessage('conv-1')).toBe(true);
    });
  });

  describe('backward compatibility', () => {
    it('falls back to default agent when a legacy plain string is in storage', () => {
      // Anything stashed before the handoff carried the agent field is a
      // bare message string. Old encoding → treat as { text, agent: 'default' }.
      sessionStorage.setItem(INITIAL_MESSAGE_STORAGE_KEY('conv-1'), 'legacy text');

      const peeked = peekPendingInitialMessage('conv-1');
      expect(peeked).toEqual({ text: 'legacy text', agent: 'default' });
    });

    it('defaults missing agent field to "default" inside a JSON record', () => {
      sessionStorage.setItem(
        INITIAL_MESSAGE_STORAGE_KEY('conv-1'),
        JSON.stringify({ text: 'partial' }),
      );

      expect(peekPendingInitialMessage('conv-1')).toEqual({
        text: 'partial',
        agent: 'default',
      });
    });
  });

  describe('safety', () => {
    it('returns null for an undefined conversationId', () => {
      expect(peekPendingInitialMessage(undefined)).toBeNull();
      expect(consumePendingInitialMessage(undefined)).toBeNull();
      expect(hasPendingInitialMessage(undefined)).toBe(false);
    });

    it('scopes keys per conversationId — one consume does not leak across ids', () => {
      writePendingInitialMessage('conv-a', { text: 'A', agent: 'default' });
      writePendingInitialMessage('conv-b', { text: 'B', agent: 'flow-x' });

      const a = consumePendingInitialMessage('conv-a');
      expect(a).toEqual({ text: 'A', agent: 'default' });
      // ``conv-b`` is untouched.
      expect(peekPendingInitialMessage('conv-b')).toEqual({
        text: 'B',
        agent: 'flow-x',
      });
    });
  });
});

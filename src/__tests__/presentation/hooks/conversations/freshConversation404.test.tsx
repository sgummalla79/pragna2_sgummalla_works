/**
 * Fresh-conversation 404 handling for conversation-scoped hooks.
 *
 * A "+ New chat" creates a client-side thread_id; the conversation row
 * is created lazily on first send. Until that happens, every
 * conversation-scoped GET (/messages, /usage, /episodes) 404s because
 * the row doesn't exist for the user yet.
 *
 * The fix: each hook catches axios 404 and resolves to the natural
 * zero-state (empty list / zero usage / no open episode) instead of
 * surfacing as a query error. These tests pin that behaviour so a
 * future refactor can't quietly re-introduce the console noise.
 *
 * Non-404 errors (500, network, etc.) still propagate as query errors
 * so genuine BE bugs stay visible — also covered here.
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useConversationUsage } from '@/presentation/hooks/conversations/useConversations';
import { useConversationMessages } from '@/presentation/hooks/conversations/useConversationMessages';
import {
  ServiceContext,
  type Services,
} from '@/presentation/providers/ServiceContext';

const FRESH_ID = 'b310bba3-7d76-4c02-9031-5d1ee39236ce';

/** Build an axios-shaped error with a given HTTP status. The hooks'
 *  catch arm uses ``axios.isAxiosError`` so the shape — flag +
 *  ``response.status`` — is what matters. */
function axiosLikeError(status: number) {
  const err = new Error(`HTTP ${status}`) as Error & {
    isAxiosError: boolean;
    response: { status: number };
  };
  err.isAxiosError = true;
  err.response = { status };
  return err;
}

function makeWrapper(services: Services) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <ServiceContext.Provider value={services}>
        {children}
      </ServiceContext.Provider>
    </QueryClientProvider>
  );
  return { wrapper, qc };
}

describe('useConversationMessages — fresh-conversation 404 handling', () => {
  // ── Note ────────────────────────────────────────────────────────────
  // The 404→[] race-guard for messages lives at the REPO layer
  // (``ConversationRepository.getMessages``), NOT in the hook — so a
  // mocked service that rejects with 404 reflects "repo bug" semantics,
  // not "live 404" semantics. The repo's catch is implicitly exercised
  // every time a 404 reaches the integration test
  // ``test_fresh_conversation_lifecycle`` (DELETE → re-GET → 404).
  //
  // Hook-level test for the propagation invariant kept below so a
  // future regression (e.g. re-adding a hook-level catch that
  // accidentally swallows 5xx) gets caught.

  it('propagates non-404 errors so genuine BE failures stay visible', async () => {
    const getMessages = vi.fn(() => Promise.reject(axiosLikeError(500)));
    const services = {
      conversationService: { getMessages },
    } as unknown as Services;
    const { wrapper } = makeWrapper(services);

    const { result } = renderHook(() => useConversationMessages(FRESH_ID), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.data).toBeUndefined();
  });
});

describe('useConversationUsage — fresh-conversation 404 handling', () => {
  it('returns a zero-state ConversationUsage when the usage endpoint 404s', async () => {
    const getUsage = vi.fn(() => Promise.reject(axiosLikeError(404)));
    const services = {
      conversationService: { getUsage },
    } as unknown as Services;
    const { wrapper } = makeWrapper(services);

    const { result } = renderHook(() => useConversationUsage(FRESH_ID), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toEqual({
      conversationId: FRESH_ID,
      records: [],
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCostUsd: '0',
    });
    expect(result.current.isError).toBe(false);
    expect(getUsage).toHaveBeenCalledTimes(1);
  });

  it('propagates non-404 errors so genuine failures stay visible', async () => {
    const getUsage = vi.fn(() => Promise.reject(axiosLikeError(500)));
    const services = {
      conversationService: { getUsage },
    } as unknown as Services;
    const { wrapper } = makeWrapper(services);

    const { result } = renderHook(() => useConversationUsage(FRESH_ID), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.data).toBeUndefined();
  });
});

/**
 * Tests for ``ConversationRepository.create`` (eager-create path).
 *
 * Pins the request/response shape and the camelCase ↔ snake_case
 * boundary mapping. Lives in its own file so the existing repository
 * (which doesn't have a test file yet for its other methods) is not
 * implicitly broadened.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import axios from 'axios';
import { ConversationRepository } from '@/infrastructure/repositories/ConversationRepository';

const BASE_URL = 'http://localhost:8000';
const THREAD_ID = '11111111-1111-1111-1111-111111111111';

const SAMPLE_RESPONSE = {
  id: THREAD_ID,
  flow_id: null,
  thread_id: THREAD_ID,
  user_model_id: 'model-1',
  title: null,
  thinking_enabled: false,
  pinned: false,
  pinned_at: null,
  created_at: '2026-05-25T00:00:00Z',
};

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const repo = new ConversationRepository(axios.create({ baseURL: BASE_URL }));

describe('ConversationRepository.create', () => {
  it('POSTs snake_case body and maps response → camelCase', async () => {
    let capturedBody: unknown = null;
    server.use(
      http.post(`${BASE_URL}/api/conversations`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(SAMPLE_RESPONSE, { status: 201 });
      }),
    );

    const result = await repo.create({
      threadId: THREAD_ID,
      userModelId: 'model-1',
      thinkingEnabled: false,
    });

    expect(capturedBody).toEqual({
      thread_id: THREAD_ID,
      user_model_id: 'model-1',
      thinking_enabled: false,
    });
    expect(result).toEqual({
      id: THREAD_ID,
      flowId: null,
      threadId: THREAD_ID,
      userModelId: 'model-1',
      title: null,
      thinkingEnabled: false,
      pinned: false,
      pinnedAt: null,
      createdAt: '2026-05-25T00:00:00Z',
    });
  });

  it('omits optional fields from the request body when undefined', async () => {
    // Defensive: don't send ``user_model_id: undefined`` over the wire.
    // The BE accepts missing fields but a literal ``null`` vs missing
    // changes its meaning ("unset model" vs "leave default").
    let capturedBody: unknown = null;
    server.use(
      http.post(`${BASE_URL}/api/conversations`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(SAMPLE_RESPONSE, { status: 201 });
      }),
    );

    await repo.create({ threadId: THREAD_ID });

    expect(capturedBody).toEqual({ thread_id: THREAD_ID });
  });

  it('maps the 200 (idempotent retry) response identically to 201', async () => {
    // BE returns 200 when the row already exists (retry / double-click).
    // The repo doesn't branch on status — both shapes resolve to the
    // same domain entity. Pinned so this assumption survives refactors.
    server.use(
      http.post(`${BASE_URL}/api/conversations`, () =>
        HttpResponse.json(SAMPLE_RESPONSE, { status: 200 }),
      ),
    );

    const result = await repo.create({ threadId: THREAD_ID });
    expect(result.id).toBe(THREAD_ID);
  });

  it('propagates 409 (cross-user thread_id collision) as axios error', async () => {
    server.use(
      http.post(`${BASE_URL}/api/conversations`, () =>
        HttpResponse.json(
          { detail: 'thread_id already in use.' },
          { status: 409 },
        ),
      ),
    );

    await expect(
      repo.create({ threadId: THREAD_ID }),
    ).rejects.toMatchObject({
      response: { status: 409 },
    });
  });
});

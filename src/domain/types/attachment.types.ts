/** R5 — files attached to a chat turn. */

export interface Attachment {
  id: string;
  /** ``null`` when the upload happened before the conversation row
   *  was created (landing-page upload); the link is stamped at
   *  send-time. */
  conversationId: string | null;
  /** ``null`` while the upload is staged but not yet sent. Populated
   *  by the backend when the user message is persisted. */
  messageId: string | null;
  /** Original filename. Display-only — never used as a key. */
  filename: string;
  /** MIME type detected at upload (e.g. ``image/png``). */
  contentType: string;
  sizeBytes: number;
  /** ISO 8601 UTC. */
  uploadedAt: string;
  /** ``true`` if the retention cron has expired the bytes. Chat
   *  history renders a "[file expired]" placeholder. */
  expired: boolean;
}

/** Local-only state for an attachment in the composer before send. */
export interface StagedAttachment extends Attachment {
  /** Object URL for preview (``URL.createObjectURL``). Revoked on
   *  unstage / unmount. */
  previewUrl?: string;
}

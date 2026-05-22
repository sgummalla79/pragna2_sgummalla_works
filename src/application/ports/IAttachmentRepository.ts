import type { Attachment } from '@/domain/types/attachment.types';

/** R5 — attachment HTTP contract.
 *
 *  Two operations:
 *  - ``upload``: multipart POST to ``/api/conversations/{convoId}/attachments``.
 *    Returns the metadata row created by the backend. The actual bytes
 *    are NOT round-tripped through the frontend — the backend reads
 *    them straight out of the multipart form data.
 *  - ``contentUrl``: produce the URL the browser uses to fetch the
 *    bytes for inline display (``<img src>`` etc). Routed through our
 *    bearer-auth backend instead of presigned URLs so ownership is
 *    enforced on every fetch.
 */
export interface IAttachmentRepository {
  upload(conversationId: string, file: File): Promise<Attachment>;
  contentUrl(attachmentId: string): string;
}

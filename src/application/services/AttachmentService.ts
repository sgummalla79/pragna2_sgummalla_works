import type { IAttachmentRepository } from '@/application/ports/IAttachmentRepository';
import type { Attachment } from '@/domain/types/attachment.types';

/** One-line delegation today — the service exists so callers acquire
 *  the dep through ``useServices()`` and future cross-cutting concerns
 *  (retries, optimistic updates, telemetry) land here without changing
 *  call sites. */
export class AttachmentService {
  constructor(private readonly attachmentRepository: IAttachmentRepository) {}

  upload(conversationId: string, file: File): Promise<Attachment> {
    return this.attachmentRepository.upload(conversationId, file);
  }

  contentUrl(attachmentId: string): string {
    return this.attachmentRepository.contentUrl(attachmentId);
  }
}

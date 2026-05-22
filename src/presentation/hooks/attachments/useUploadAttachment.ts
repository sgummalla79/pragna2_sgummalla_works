import { useMutation } from '@tanstack/react-query';
import { useServices } from '@/presentation/providers/ServiceContext';
import type { Attachment } from '@/domain/types/attachment.types';

/**
 * R5. Uploads a single file to a conversation, returning the
 * Attachment metadata the backend created. The composer calls this
 * once per dropped/picked file; staging state for the in-flight chips
 * lives in :func:`useStagedAttachments`.
 */
export function useUploadAttachment() {
  const { attachmentService } = useServices();
  return useMutation<Attachment, Error, { conversationId: string; file: File }>({
    mutationFn: ({ conversationId, file }) =>
      attachmentService.upload(conversationId, file),
  });
}

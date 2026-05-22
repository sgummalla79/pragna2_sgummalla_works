import type { AxiosInstance } from 'axios';
import type { IAttachmentRepository } from '@/application/ports/IAttachmentRepository';
import type { Attachment } from '@/domain/types/attachment.types';
import { API_BASE_URL } from '@/constants/api';

interface ApiAttachmentResponse {
  id: string;
  conversation_id: string | null;
  message_id: string | null;
  filename: string;
  content_type: string;
  size_bytes: number;
  uploaded_at: string;
  expired: boolean;
}

export function mapAttachment(raw: ApiAttachmentResponse): Attachment {
  return {
    id: raw.id,
    conversationId: raw.conversation_id,
    messageId: raw.message_id,
    filename: raw.filename,
    contentType: raw.content_type,
    sizeBytes: raw.size_bytes,
    uploadedAt: raw.uploaded_at,
    expired: raw.expired,
  };
}

export class AttachmentRepository implements IAttachmentRepository {
  constructor(private readonly http: AxiosInstance) {}

  async upload(conversationId: string, file: File): Promise<Attachment> {
    const formData = new FormData();
    formData.append('file', file);
    // axios picks the right Content-Type (multipart/form-data with the
    // boundary) automatically when the data is FormData; explicitly
    // setting it would strip the boundary parameter and break the
    // backend's multipart parser.
    const { data } = await this.http.post<ApiAttachmentResponse>(
      `/api/conversations/${conversationId}/attachments`,
      formData,
    );
    return mapAttachment(data);
  }

  contentUrl(attachmentId: string): string {
    // The bytes are served by the backend at this path with bearer
    // auth required. We return a same-origin URL — the browser sends
    // cookies / auth headers per the global axios setup.
    return `${API_BASE_URL}/api/attachments/${attachmentId}/content`;
  }
}

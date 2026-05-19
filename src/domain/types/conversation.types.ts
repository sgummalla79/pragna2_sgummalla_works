export interface Conversation {
  id: string;
  flowId: string | null;
  threadId: string;
  title: string | null;
  createdAt: string;
}

export interface UsageRecord {
  id: string;
  userModelId: string;
  nodeId: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: string;
  createdAt: string;
}

export interface ConversationUsage {
  conversationId: string;
  records: UsageRecord[];
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: string;
}

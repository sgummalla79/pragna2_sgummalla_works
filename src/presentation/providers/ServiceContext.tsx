import { createContext, useContext } from 'react';
import type { AgentService } from '@/application/services/AgentService';
import type { AttachmentService } from '@/application/services/AttachmentService';
import type { AuthService } from '@/application/services/AuthService';
import type { ConversationService } from '@/application/services/ConversationService';
import type { EpisodeService } from '@/application/services/EpisodeService';
import type { FlowService } from '@/application/services/FlowService';
import type { LlmProviderService } from '@/application/services/LlmProviderService';
import type { McpServerService } from '@/application/services/McpServerService';
import type { ModelService } from '@/application/services/ModelService';
import type { ProviderService } from '@/application/services/ProviderService';
import type { SkillService } from '@/application/services/SkillService';
import type { ToolService } from '@/application/services/ToolService';
import type { UserAgentService } from '@/application/services/UserAgentService';

export interface Services {
  authService: AuthService;
  llmProviderService: LlmProviderService;
  providerService: ProviderService;
  modelService: ModelService;
  flowService: FlowService;
  episodeService: EpisodeService;
  skillService: SkillService;
  conversationService: ConversationService;
  agentService: AgentService;
  userAgentService: UserAgentService;
  attachmentService: AttachmentService;
  /** Wedge B.2 — MCP server registrations + lifecycle. */
  mcpServerService: McpServerService;
  /** Wedge B.2 — flat tool list (global + per-user) + per-tool toggle. */
  toolService: ToolService;
}

export const ServiceContext = createContext<Services | null>(null);

export function useServices(): Services {
  const ctx = useContext(ServiceContext);
  if (!ctx) throw new Error('useServices must be used inside ServiceProvider');
  return ctx;
}

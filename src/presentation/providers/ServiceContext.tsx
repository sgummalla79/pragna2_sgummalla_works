import { createContext, useContext } from 'react';
import type { AgentService } from '@/application/services/AgentService';
import type { AttachmentService } from '@/application/services/AttachmentService';
import type { AuthService } from '@/application/services/AuthService';
import type { ConversationService } from '@/application/services/ConversationService';
import type { FlowRunService } from '@/application/services/FlowRunService';
import type { FlowService } from '@/application/services/FlowService';
import type { LlmProviderService } from '@/application/services/LlmProviderService';
import type { ModelService } from '@/application/services/ModelService';
import type { ProviderService } from '@/application/services/ProviderService';
import type { SkillService } from '@/application/services/SkillService';
import type { UserAgentService } from '@/application/services/UserAgentService';

export interface Services {
  authService: AuthService;
  llmProviderService: LlmProviderService;
  providerService: ProviderService;
  modelService: ModelService;
  flowService: FlowService;
  flowRunService: FlowRunService;
  skillService: SkillService;
  conversationService: ConversationService;
  agentService: AgentService;
  userAgentService: UserAgentService;
  attachmentService: AttachmentService;
}

export const ServiceContext = createContext<Services | null>(null);

export function useServices(): Services {
  const ctx = useContext(ServiceContext);
  if (!ctx) throw new Error('useServices must be used inside ServiceProvider');
  return ctx;
}

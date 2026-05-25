import { useMemo, type ReactNode } from 'react';
import { axiosClient } from '@/infrastructure/http/axiosClient';
import { applyAuthInterceptor } from '@/infrastructure/http/authInterceptor';
import { applyCorrelationInterceptor } from '@/infrastructure/http/correlationInterceptor';
import { Auth0Repository } from '@/infrastructure/auth0/Auth0Repository';
import { AgentRepository } from '@/infrastructure/repositories/AgentRepository';
import { AttachmentRepository } from '@/infrastructure/repositories/AttachmentRepository';
import { ConversationRepository } from '@/infrastructure/repositories/ConversationRepository';
import { EpisodeRepository } from '@/infrastructure/repositories/EpisodeRepository';
import { FlowRepository } from '@/infrastructure/repositories/FlowRepository';
import { LlmProviderRepository } from '@/infrastructure/repositories/LlmProviderRepository';
import { McpServerRepository } from '@/infrastructure/repositories/McpServerRepository';
import { ModelRepository } from '@/infrastructure/repositories/ModelRepository';
import { ProviderRepository } from '@/infrastructure/repositories/ProviderRepository';
import { SkillRepository } from '@/infrastructure/repositories/SkillRepository';
import { ToolRepository } from '@/infrastructure/repositories/ToolRepository';
import { UserAgentRepository } from '@/infrastructure/repositories/UserAgentRepository';
import { AgentService } from '@/application/services/AgentService';
import { AttachmentService } from '@/application/services/AttachmentService';
import { AuthService } from '@/application/services/AuthService';
import { ConversationService } from '@/application/services/ConversationService';
import { EpisodeService } from '@/application/services/EpisodeService';
import { FlowService } from '@/application/services/FlowService';
import { LlmProviderService } from '@/application/services/LlmProviderService';
import { McpServerService } from '@/application/services/McpServerService';
import { ModelService } from '@/application/services/ModelService';
import { ProviderService } from '@/application/services/ProviderService';
import { SkillService } from '@/application/services/SkillService';
import { ToolService } from '@/application/services/ToolService';
import { UserAgentService } from '@/application/services/UserAgentService';
import { useAuthStore } from '@/presentation/store/authStore';
import { ServiceContext } from './ServiceContext';

applyCorrelationInterceptor(axiosClient);

interface ServiceProviderProps {
  children: ReactNode;
}

export function ServiceProvider({ children }: ServiceProviderProps) {
  const reset = useAuthStore((s) => s.reset);

  const services = useMemo(() => {
    applyAuthInterceptor(axiosClient, reset);

    const authRepo           = new Auth0Repository(axiosClient);
    const llmProviderRepo    = new LlmProviderRepository(axiosClient);
    const providerRepo       = new ProviderRepository(axiosClient);
    const modelRepo          = new ModelRepository(axiosClient);
    const flowRepo           = new FlowRepository(axiosClient);
    const episodeRepo        = new EpisodeRepository(axiosClient);
    const skillRepo          = new SkillRepository(axiosClient);
    const conversationRepo   = new ConversationRepository(axiosClient);
    const agentRepo          = new AgentRepository(axiosClient);
    const userAgentRepo      = new UserAgentRepository(axiosClient);
    const attachmentRepo     = new AttachmentRepository(axiosClient);
    const mcpServerRepo      = new McpServerRepository(axiosClient);
    const toolRepo           = new ToolRepository(axiosClient);

    return {
      authService:         new AuthService(authRepo),
      llmProviderService:  new LlmProviderService(llmProviderRepo),
      providerService:     new ProviderService(providerRepo),
      modelService:        new ModelService(modelRepo),
      flowService:         new FlowService(flowRepo),
      episodeService:      new EpisodeService(episodeRepo),
      skillService:        new SkillService(skillRepo),
      conversationService: new ConversationService(conversationRepo),
      agentService:        new AgentService(agentRepo),
      userAgentService:    new UserAgentService(userAgentRepo),
      attachmentService:   new AttachmentService(attachmentRepo),
      mcpServerService:    new McpServerService(mcpServerRepo),
      toolService:         new ToolService(toolRepo),
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <ServiceContext.Provider value={services}>{children}</ServiceContext.Provider>;
}

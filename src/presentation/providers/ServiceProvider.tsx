import { useMemo, type ReactNode } from 'react';
import { axiosClient } from '@/infrastructure/http/axiosClient';
import { applyAuthInterceptor } from '@/infrastructure/http/authInterceptor';
import { applyCorrelationInterceptor } from '@/infrastructure/http/correlationInterceptor';
import { Auth0Repository } from '@/infrastructure/auth0/Auth0Repository';
import { ProviderRepository } from '@/infrastructure/repositories/ProviderRepository';
import { ModelRepository } from '@/infrastructure/repositories/ModelRepository';
import { AgentTypeRepository } from '@/infrastructure/repositories/AgentTypeRepository';
import { FlowRepository } from '@/infrastructure/repositories/FlowRepository';
import { SkillRepository } from '@/infrastructure/repositories/SkillRepository';
import { ConversationRepository } from '@/infrastructure/repositories/ConversationRepository';
import { AuthService } from '@/application/services/AuthService';
import { ProviderService } from '@/application/services/ProviderService';
import { ModelService } from '@/application/services/ModelService';
import { FlowService } from '@/application/services/FlowService';
import { SkillService } from '@/application/services/SkillService';
import { ConversationService } from '@/application/services/ConversationService';
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

    const authRepo         = new Auth0Repository(axiosClient);
    const providerRepo     = new ProviderRepository(axiosClient);
    const modelRepo        = new ModelRepository(axiosClient);
    const agentTypeRepo    = new AgentTypeRepository(axiosClient);
    const flowRepo         = new FlowRepository(axiosClient);
    const skillRepo        = new SkillRepository(axiosClient);
    const conversationRepo = new ConversationRepository(axiosClient);

    return {
      agentTypeRepository: agentTypeRepo,
      authService:         new AuthService(authRepo),
      providerService:     new ProviderService(providerRepo),
      modelService:        new ModelService(modelRepo),
      flowService:         new FlowService(flowRepo),
      skillService:        new SkillService(skillRepo),
      conversationService: new ConversationService(conversationRepo),
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <ServiceContext.Provider value={services}>{children}</ServiceContext.Provider>;
}

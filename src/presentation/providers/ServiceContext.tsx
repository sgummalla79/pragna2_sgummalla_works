import { createContext, useContext } from 'react';
import type { AuthService } from '@/application/services/AuthService';
import type { ProviderService } from '@/application/services/ProviderService';
import type { ModelService } from '@/application/services/ModelService';
import type { FlowService } from '@/application/services/FlowService';
import type { SkillService } from '@/application/services/SkillService';
import type { ConversationService } from '@/application/services/ConversationService';

export interface Services {
  authService: AuthService;
  providerService: ProviderService;
  modelService: ModelService;
  flowService: FlowService;
  skillService: SkillService;
  conversationService: ConversationService;
}

export const ServiceContext = createContext<Services | null>(null);

export function useServices(): Services {
  const ctx = useContext(ServiceContext);
  if (!ctx) throw new Error('useServices must be used inside ServiceProvider');
  return ctx;
}

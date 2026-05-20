export const ROUTES = {
  LOGIN: '/login',
  REGISTER: '/register',
  AUTH_CALLBACK: '/auth-callback',
  CHAT: '/chat',
  PROVIDERS: '/providers',
  MODELS: '/models',
  FLOWS: '/flows',
  FLOW_DETAIL: '/flows/:flowId',
  SKILLS: '/skills',
  CONVERSATIONS: '/conversations',
} as const;

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];

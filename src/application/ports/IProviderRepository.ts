import type { CreateProviderPayload, Provider } from '@/domain/types/provider.types';

export interface IProviderRepository {
  list(): Promise<Provider[]>;
  create(payload: CreateProviderPayload): Promise<Provider>;
  delete(id: string): Promise<void>;
}

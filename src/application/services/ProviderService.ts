import type { IProviderRepository } from '@/application/ports/IProviderRepository';
import type { CreateProviderPayload, Provider } from '@/domain/types/provider.types';

export class ProviderService {
  constructor(private readonly providerRepository: IProviderRepository) {}

  list(): Promise<Provider[]> {
    return this.providerRepository.list();
  }

  create(payload: CreateProviderPayload): Promise<Provider> {
    return this.providerRepository.create(payload);
  }

  delete(id: string): Promise<void> {
    return this.providerRepository.delete(id);
  }
}

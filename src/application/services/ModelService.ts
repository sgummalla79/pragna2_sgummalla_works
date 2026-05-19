import type { IModelRepository } from '@/application/ports/IModelRepository';
import type { Model, RegisterModelPayload } from '@/domain/types/model.types';

export class ModelService {
  constructor(private readonly modelRepository: IModelRepository) {}

  list(): Promise<Model[]> {
    return this.modelRepository.list();
  }

  register(payload: RegisterModelPayload): Promise<Model> {
    return this.modelRepository.register(payload);
  }

  delete(id: string): Promise<void> {
    return this.modelRepository.delete(id);
  }
}

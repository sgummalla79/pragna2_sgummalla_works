import type { Model, RegisterModelPayload } from '@/domain/types/model.types';

export interface IModelRepository {
  list(): Promise<Model[]>;
  register(payload: RegisterModelPayload): Promise<Model>;
  delete(id: string): Promise<void>;
}

import type { IModelRepository } from '@/application/ports/IModelRepository';
import type { BulkUpdateEntry, Model, UpdateModelPayload } from '@/domain/types/model.types';

/**
 * Manages user models via /api/user-models.
 *
 * Models are created automatically when a provider is registered or refreshed.
 * There is no standalone create or delete — those operations cascade from the provider.
 */
export class ModelService {
  constructor(private readonly modelRepository: IModelRepository) {}

  /** Returns all of the user's models (archived rows excluded by default). */
  list(): Promise<Model[]> {
    return this.modelRepository.list();
  }

  /**
   * Partially updates a model's user-controllable fields via PATCH.
   * Only fields present in `payload` are sent; omitted fields are unchanged.
   */
  update(id: string, payload: UpdateModelPayload): Promise<Model> {
    return this.modelRepository.update(id, payload);
  }

  /**
   * Bulk-updates many models in a single server transaction.
   * All-or-nothing — see {@link IModelRepository.bulkUpdate}.
   */
  bulkUpdate(updates: BulkUpdateEntry[]): Promise<Model[]> {
    return this.modelRepository.bulkUpdate(updates);
  }
}

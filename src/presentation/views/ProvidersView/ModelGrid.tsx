import { DataGrid } from '@/presentation/components/ui/DataGrid';
import { formatUsd } from '@/domain/utils/formatCost';
import type { GridColumn } from '@/presentation/components/ui/DataGrid';
import type { Model, UpdateModelPayload } from '@/domain/types/model.types';

/** Formats a per-token cost as a compact per-million-tokens dollar value. */
function perMillion(tokenCost: string): string {
  const n = parseFloat(tokenCost);
  return isFinite(n) && n > 0 ? formatUsd(n * 1_000_000) : '$0.00';
}

/**
 * Column definitions for the model grid.
 * Add or reorder columns here — ModelGrid and DataGrid never need to change.
 */
const MODEL_COLUMNS: GridColumn<Model>[] = [
  {
    type: 'readonly',
    key: 'modelName',
    header: 'Model',
    render: (m) => (
      <span className="whitespace-nowrap font-mono text-[13px] text-[#737373]">{m.modelName}</span>
    ),
  },
  {
    type: 'editable',
    key: 'displayName',
    header: 'Display name',
    getValue: (m) => m.displayName,
    buildPayload: (value) => ({ displayName: value.trim() }),
    isValid: (v) => v.trim().length > 0,
  },
  {
    type: 'readonly',
    key: 'costIn',
    header: '$/1M in',
    align: 'right',
    render: (m) => (
      <span className="whitespace-nowrap font-mono text-[13px] text-[#737373]">{perMillion(m.costPerInputToken)}</span>
    ),
  },
  {
    type: 'readonly',
    key: 'costOut',
    header: '$/1M out',
    align: 'right',
    render: (m) => (
      <span className="whitespace-nowrap font-mono text-[13px] text-[#737373]">{perMillion(m.costPerOutputToken)}</span>
    ),
  },
  {
    type: 'toggle',
    key: 'enabled',
    header: 'Enabled',
    align: 'center',
    getValue: (m) => m.enabled,
    buildPayload: (m) => ({ enabled: !m.enabled }),
    isDisabled: (m) => m.archived,
  },
  {
    type: 'toggle',
    key: 'availableForChat',
    header: 'Chat',
    align: 'center',
    getValue: (m) => m.availableForChat,
    buildPayload: (m) => ({ availableForChat: !m.availableForChat }),
    isDisabled: (m) => m.archived,
  },
  {
    type: 'toggle',
    key: 'availableForFlows',
    header: 'Flows',
    align: 'center',
    getValue: (m) => m.availableForFlows,
    buildPayload: (m) => ({ availableForFlows: !m.availableForFlows }),
    isDisabled: (m) => m.archived,
  },
];

interface ModelGridProps {
  models: Model[];
  /**
   * Receives cell-level changes (toggle click, editable blur/Enter).
   * Parent is responsible for buffering and surfacing Save / Cancel.
   */
  onCellChange: (id: string, payload: UpdateModelPayload) => void;
  /** Pass-through to the underlying DataGrid wrapper (e.g. `flex-1 min-h-0`). */
  className?: string;
}

/**
 * Model management grid for the provider modal — fully controlled.
 *
 * The grid is presentational: it renders rows from `models` and emits
 * cell-level changes via `onCellChange`. Persistence lives in the
 * parent (ConnectedPanel) which holds a pending-changes buffer and
 * commits via the bulk PATCH endpoint.
 *
 * Add or reorder columns in MODEL_COLUMNS — neither the grid nor the
 * parent needs to change.
 */
export function ModelGrid({ models, onCellChange, className }: ModelGridProps) {
  return (
    <DataGrid
      className={className}
      columns={MODEL_COLUMNS}
      rows={models}
      getRowId={(m) => m.id}
      onUpdate={(id, payload) => onCellChange(id, payload as UpdateModelPayload)}
      isRowDisabled={(m) => m.archived}
      emptyMessage="No models yet — click Refresh to discover models."
      hideRowSave
    />
  );
}

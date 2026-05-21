import {
  useState,
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
  type ReactNode,
  type ForwardedRef,
} from 'react';
import { cn } from '@/lib/utils';

// ── Column type definitions ────────────────────────────────────────────────────

export type Align = 'left' | 'center' | 'right';

export interface ReadonlyColumn<T> {
  type: 'readonly';
  key: string;
  header: string;
  align?: Align;
  render: (row: T) => ReactNode;
}

export interface EditableColumn<T> {
  type: 'editable';
  key: string;
  header: string;
  align?: Align;
  getValue: (row: T) => string;
  buildPayload: (newValue: string) => Record<string, unknown>;
  isValid?: (value: string) => boolean;
}

export interface ToggleColumn<T> {
  type: 'toggle';
  key: string;
  header: string;
  align?: Align;
  getValue: (row: T) => boolean;
  buildPayload: (row: T) => Record<string, unknown>;
  isDisabled?: (row: T) => boolean;
}

export type GridColumn<T> = ReadonlyColumn<T> | EditableColumn<T> | ToggleColumn<T>;

// ── Imperative handle ─────────────────────────────────────────────────────────

export interface DataGridHandle {
  /** Saves all rows that have pending edits. */
  save: () => Promise<void>;
  /** Discards all pending edits, restoring original values. */
  cancel: () => void;
}

// ── DataGrid props ─────────────────────────────────────────────────────────────

interface DataGridProps<T> {
  columns: GridColumn<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  onUpdate: (id: string, payload: Record<string, unknown>) => Promise<void> | void;
  isRowDisabled?: (row: T) => boolean;
  emptyMessage?: string;
  className?: string;
  /** Fired whenever the overall dirty state changes (any editable cell differs from original). */
  onDirtyChange?: (isDirty: boolean) => void;
}

// ── DataGrid (forwardRef, generic) ────────────────────────────────────────────

function DataGridInner<T>(
  {
    columns,
    rows,
    getRowId,
    onUpdate,
    isRowDisabled,
    emptyMessage = 'No data.',
    className,
    onDirtyChange,
  }: DataGridProps<T>,
  ref: ForwardedRef<DataGridHandle>
) {
  const editableCols = columns.filter((c): c is EditableColumn<T> => c.type === 'editable');

  // All editable cell values hoisted here so DataGrid can compute global dirty state
  // and expose save/cancel imperatively.
  const makeInitial = () =>
    Object.fromEntries(
      rows.map((row) => [
        getRowId(row),
        Object.fromEntries(editableCols.map((c) => [c.key, c.getValue(row)])),
      ])
    );

  const [editValues, setEditValues] = useState<Record<string, Record<string, string>>>(makeInitial);
  const [pendingToggles, setPendingToggles] = useState<Set<string>>(new Set());
  const [savingRows, setSavingRows] = useState<Set<string>>(new Set());

  const isDirtyFor = (row: T) => {
    const id = getRowId(row);
    return editableCols.some((c) => {
      const current = editValues[id]?.[c.key] ?? c.getValue(row);
      const valid = c.isValid ? c.isValid(current) : current.trim() !== '';
      return valid && current !== c.getValue(row);
    });
  };

  const isDirty = rows.some(isDirtyFor);

  // Notify parent when dirty state changes
  const prevDirty = useRef(false);
  useEffect(() => {
    if (isDirty !== prevDirty.current) {
      prevDirty.current = isDirty;
      onDirtyChange?.(isDirty);
    }
  });

  // Expose save / cancel via ref
  useImperativeHandle(ref, () => ({
    async save() {
      const dirtyRows = rows.filter(isDirtyFor);
      for (const row of dirtyRows) {
        const id = getRowId(row);
        const payload: Record<string, unknown> = {};
        for (const col of editableCols) {
          const current = editValues[id]?.[col.key] ?? col.getValue(row);
          if (current !== col.getValue(row)) {
            Object.assign(payload, col.buildPayload(current));
          }
        }
        setSavingRows((prev) => new Set(prev).add(id));
        try {
          await onUpdate(id, payload);
        } finally {
          setSavingRows((prev) => { const s = new Set(prev); s.delete(id); return s; });
        }
      }
    },
    cancel() {
      setEditValues(makeInitial());
    },
  }));

  async function handleToggle(rowId: string, col: ToggleColumn<T>, row: T) {
    const key = `${rowId}:${col.key}`;
    if (pendingToggles.has(key)) return;
    setPendingToggles((prev) => new Set(prev).add(key));
    try {
      await onUpdate(rowId, col.buildPayload(row));
    } finally {
      setPendingToggles((prev) => { const s = new Set(prev); s.delete(key); return s; });
    }
  }

  if (rows.length === 0) {
    return <p className="py-3 text-[12px] text-[#737373]">{emptyMessage}</p>;
  }

  const alignClass: Record<Align, string> = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  };

  return (
    <div className={cn('overflow-auto rounded-lg border border-[rgba(255,255,255,0.08)]', className)}>
      <table className="w-full border-separate border-spacing-0 text-[14px]">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  'sticky top-0 z-10 bg-[#2a2a2a] border-b border-[rgba(255,255,255,0.08)]',
                  'whitespace-nowrap px-3 py-3 text-[12px] font-bold uppercase tracking-wide text-[#737373]',
                  alignClass[col.align ?? 'left']
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const id = getRowId(row);
            const disabled = isRowDisabled?.(row) ?? false;
            const isSaving = savingRows.has(id);

            return (
              <tr
                key={id}
                className={cn(
                  'transition-colors hover:bg-[rgba(255,255,255,0.02)]',
                  i < rows.length - 1 && 'border-b border-[rgba(255,255,255,0.05)]',
                  disabled && 'opacity-50'
                )}
              >
                {columns.map((col) => {
                  const align = alignClass[col.align ?? 'left'];

                  if (col.type === 'readonly') {
                    return (
                      <td key={col.key} className={cn('px-3 py-3', align)}>
                        {col.render(row)}
                      </td>
                    );
                  }

                  if (col.type === 'editable') {
                    const value = editValues[id]?.[col.key] ?? col.getValue(row);
                    return (
                      <td key={col.key} className={cn('px-2 py-2', align)}>
                        <input
                          value={value}
                          onChange={(e) =>
                            setEditValues((prev) => ({
                              ...prev,
                              [id]: { ...prev[id], [col.key]: e.target.value },
                            }))
                          }
                          disabled={disabled || isSaving}
                          className={cn(
                            'w-full cursor-text rounded-md border border-[rgba(255,255,255,0.12)]',
                            'bg-[rgba(255,255,255,0.05)] px-2.5 py-1.5 text-[14px] text-[#ececea] outline-none',
                            'transition-colors duration-150',
                            'hover:border-[rgba(255,255,255,0.22)] hover:bg-[rgba(255,255,255,0.08)]',
                            'focus:border-[rgba(201,112,64,0.55)] focus:bg-[rgba(255,255,255,0.08)]',
                            'disabled:cursor-not-allowed disabled:opacity-50'
                          )}
                        />
                      </td>
                    );
                  }

                  // toggle
                  const toggleKey = `${id}:${col.key}`;
                  const active = col.getValue(row);
                  const isPending = pendingToggles.has(toggleKey);
                  const isDisabled = disabled || isPending || (col.isDisabled?.(row) ?? false);

                  return (
                    <td key={col.key} className={cn('px-3 py-3', align)}>
                      <button
                        onClick={() => handleToggle(id, col, row)}
                        disabled={isDisabled}
                        aria-pressed={active}
                        aria-label={col.header}
                        className={cn(
                          'mx-auto flex h-5 w-5 items-center justify-center rounded-full transition-all duration-150',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-ring)]',
                          'disabled:cursor-not-allowed disabled:opacity-40',
                          active
                            ? 'bg-[var(--color-brand)] shadow-[0_0_6px_rgba(201,112,64,0.4)]'
                            : 'bg-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.16)]'
                        )}
                      >
                        {isPending ? (
                          <span className="text-[8px] text-white">…</span>
                        ) : active ? (
                          <CheckMark />
                        ) : null}
                      </button>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// TypeScript generic forwardRef pattern
export const DataGrid = forwardRef(DataGridInner) as <T>(
  props: DataGridProps<T> & { ref?: React.Ref<DataGridHandle> }
) => React.ReactElement | null;

function CheckMark() {
  return (
    <svg
      width="10" height="10" viewBox="0 0 12 12"
      fill="none" stroke="white" strokeWidth="2.5"
      strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 6l3 3 5-5" />
    </svg>
  );
}

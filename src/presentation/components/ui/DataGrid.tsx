import { useState, type ReactNode } from 'react';
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

/**
 * Cell whose value the user can edit inline.
 * `onUpdate` is called on blur when the value has changed — the parent
 * is responsible for buffering and persisting the change.
 */
export interface EditableColumn<T> {
  type: 'editable';
  key: string;
  header: string;
  align?: Align;
  getValue: (row: T) => string;
  buildPayload: (newValue: string) => Record<string, unknown>;
  isValid?: (value: string) => boolean;
}

/**
 * Cell that fires `onUpdate` immediately on click — no blur needed.
 * Used for boolean toggles (enabled, available_for_chat, etc.).
 */
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

// ── DataGrid ──────────────────────────────────────────────────────────────────

interface DataGridProps<T> {
  columns: GridColumn<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  /**
   * Called when a cell change should be persisted.
   * - editable cells: called on blur when the value differs from the original
   * - toggle cells: called immediately on click
   */
  onUpdate: (id: string, payload: Record<string, unknown>) => void;
  isRowDisabled?: (row: T) => boolean;
  emptyMessage?: string;
  className?: string;
}

/**
 * Generic data grid driven entirely by column config.
 *
 * Two interaction modes:
 *  - editable → inline input; calls onUpdate on blur when changed
 *  - toggle   → dot button; calls onUpdate immediately on click
 *  - readonly → display only
 *
 * The parent owns persistence (buffering, PATCH, invalidation).
 */
export function DataGrid<T>({
  columns,
  rows,
  getRowId,
  onUpdate,
  isRowDisabled,
  emptyMessage = 'No data.',
  className,
}: DataGridProps<T>) {
  if (rows.length === 0) {
    return <p className="py-3 text-[12px] text-muted-foreground">{emptyMessage}</p>;
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
                  'sticky top-0 z-10 bg-card border-b border-[rgba(255,255,255,0.08)]',
                  'whitespace-nowrap px-3 py-3 text-[12px] font-bold uppercase tracking-wide text-muted-foreground',
                  alignClass[col.align ?? 'left']
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <DataGridRow
              key={getRowId(row)}
              row={row}
              rowId={getRowId(row)}
              columns={columns}
              onUpdate={onUpdate}
              disabled={isRowDisabled?.(row) ?? false}
              isLast={i === rows.length - 1}
              alignClass={alignClass}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Row ────────────────────────────────────────────────────────────────────────

interface DataGridRowProps<T> {
  row: T;
  rowId: string;
  columns: GridColumn<T>[];
  onUpdate: (id: string, payload: Record<string, unknown>) => void;
  disabled: boolean;
  isLast: boolean;
  alignClass: Record<Align, string>;
}

function DataGridRow<T>({
  row, rowId, columns, onUpdate, disabled, isLast, alignClass,
}: DataGridRowProps<T>) {
  // Local draft state per editable column — reset when row prop changes
  const editableCols = columns.filter((c): c is EditableColumn<T> => c.type === 'editable');
  const [drafts, setDrafts] = useState<Record<string, string>>(
    () => Object.fromEntries(editableCols.map((c) => [c.key, c.getValue(row)]))
  );
  const [pendingToggle, setPendingToggle] = useState<string | null>(null);

  function commitDraft(col: EditableColumn<T>) {
    const draft = drafts[col.key] ?? col.getValue(row);
    const original = col.getValue(row);
    if (draft === original) return;
    const valid = col.isValid ? col.isValid(draft) : draft.trim() !== '';
    if (!valid) {
      setDrafts((prev) => ({ ...prev, [col.key]: original })); // revert
      return;
    }
    onUpdate(rowId, col.buildPayload(draft));
  }

  async function handleToggle(col: ToggleColumn<T>) {
    if (pendingToggle || disabled) return;
    setPendingToggle(col.key);
    try {
      onUpdate(rowId, col.buildPayload(row));
    } finally {
      setPendingToggle(null);
    }
  }

  return (
    <tr
      className={cn(
        'transition-colors hover:bg-[rgba(255,255,255,0.02)]',
        !isLast && 'border-b border-[rgba(255,255,255,0.05)]',
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
          const draft = drafts[col.key] ?? col.getValue(row);
          return (
            <td key={col.key} className={cn('px-2 py-2', align)}>
              <input
                value={draft}
                onChange={(e) => setDrafts((prev) => ({ ...prev, [col.key]: e.target.value }))}
                onBlur={() => commitDraft(col)}
                onKeyDown={(e) => { if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); } }}
                disabled={disabled}
                className={cn(
                  'w-full cursor-text rounded-md border border-[rgba(255,255,255,0.12)]',
                  'bg-[rgba(255,255,255,0.05)] px-2.5 py-1.5 text-[14px] text-foreground outline-none',
                  'transition-colors duration-150',
                  'hover:border-[rgba(255,255,255,0.22)] hover:bg-[rgba(255,255,255,0.08)]',
                  'focus:border-primary focus:bg-[rgba(255,255,255,0.08)]',
                  'disabled:cursor-not-allowed disabled:opacity-50'
                )}
              />
            </td>
          );
        }

        // toggle
        const active = col.getValue(row);
        const isPending = pendingToggle === col.key;
        const isDisabled = disabled || !!pendingToggle || (col.isDisabled?.(row) ?? false);

        return (
          <td key={col.key} className={cn('px-3 py-3', align)}>
            <button
              onClick={() => handleToggle(col)}
              disabled={isDisabled}
              aria-pressed={active}
              aria-label={col.header}
              className={cn(
                'mx-auto flex h-5 w-5 items-center justify-center rounded-full transition-all duration-150',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]',
                'disabled:cursor-not-allowed disabled:opacity-40',
                active
                  ? 'bg-primary shadow-[0_0_6px_var(--color-primary)]'
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
}

function CheckMark() {
  return (
    <svg width="10" height="10" viewBox="0 0 12 12"
      fill="none" stroke="white" strokeWidth="2.5"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 6l3 3 5-5" />
    </svg>
  );
}

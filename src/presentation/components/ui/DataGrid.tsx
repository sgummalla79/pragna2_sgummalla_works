import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

// ── Column type definitions ────────────────────────────────────────────────────

export type Align = 'left' | 'center' | 'right';

/** Cell that just displays — no interaction. */
export interface ReadonlyColumn<T> {
  type: 'readonly';
  key: string;
  header: string;
  align?: Align;
  render: (row: T) => ReactNode;
}

/**
 * Cell whose value is locally editable.
 * Changes accumulate in row-level state; a Save button appears when the row
 * has any editable columns that differ from the original value.
 */
export interface EditableColumn<T> {
  type: 'editable';
  key: string;
  header: string;
  align?: Align;
  getValue: (row: T) => string;
  /** Maps the edited string value to the PATCH payload sent on Save. */
  buildPayload: (newValue: string) => Record<string, unknown>;
  /** Return false to keep Save disabled (e.g. empty string). Defaults to truthy check. */
  isValid?: (value: string) => boolean;
}

/**
 * Cell that fires an update immediately on click — no Save needed.
 * Used for boolean toggles (enabled, available_for_chat, etc.).
 */
export interface ToggleColumn<T> {
  type: 'toggle';
  key: string;
  header: string;
  align?: Align;
  getValue: (row: T) => boolean;
  /** Maps the current row to the payload that flips the toggle. */
  buildPayload: (row: T) => Record<string, unknown>;
  isDisabled?: (row: T) => boolean;
}

export type GridColumn<T> = ReadonlyColumn<T> | EditableColumn<T> | ToggleColumn<T>;

// ── DataGrid component ─────────────────────────────────────────────────────────

interface DataGridProps<T> {
  /** Column definitions — drives all rendering and update logic. */
  columns: GridColumn<T>[];
  rows: T[];
  /** Extracts the unique row key (used as React key and for onUpdate). */
  getRowId: (row: T) => string;
  /**
   * Called when a row is saved (editable columns) or a toggle is clicked.
   * Receives the row id and the partial payload to PATCH.
   */
  onUpdate: (id: string, payload: Record<string, unknown>) => Promise<void>;
  /** When true the entire row is visually muted and interactions are blocked. */
  isRowDisabled?: (row: T) => boolean;
  emptyMessage?: string;
  className?: string;
}

/**
 * Generic data grid driven entirely by column config.
 *
 * Three cell interaction modes:
 *  - readonly  → displays only
 *  - editable  → inline text edit, row-level Save button when dirty
 *  - toggle    → immediate PATCH on click, no Save needed
 *
 * To add a new column: extend the columns array. The component never needs to change.
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
    return (
      <p className="py-3 text-[12px] text-[#737373]">{emptyMessage}</p>
    );
  }

  const alignClass: Record<Align, string> = {
    left:   'text-left',
    center: 'text-center',
    right:  'text-right',
  };

  return (
    <div className={cn('overflow-x-auto rounded-lg border border-[rgba(255,255,255,0.08)]', className)}>
      <table className="w-full border-collapse text-[14px]">
        <thead>
          <tr className="border-b border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)]">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  'px-3 py-3 text-[12px] font-bold uppercase tracking-wide text-[#737373]',
                  alignClass[col.align ?? 'left']
                )}
              >
                {col.header}
              </th>
            ))}
            {/* Extra column for the row-level Save button */}
            <th className="w-14" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <DataGridRow
              key={getRowId(row)}
              row={row}
              columns={columns}
              onUpdate={(payload) => onUpdate(getRowId(row), payload)}
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
  columns: GridColumn<T>[];
  onUpdate: (payload: Record<string, unknown>) => Promise<void>;
  disabled: boolean;
  isLast: boolean;
  alignClass: Record<Align, string>;
}

function DataGridRow<T>({ row, columns, onUpdate, disabled, isLast, alignClass }: DataGridRowProps<T>) {
  // Local state for all editable columns — keyed by column.key
  const editableCols = columns.filter((c): c is EditableColumn<T> => c.type === 'editable');
  const [editValues, setEditValues] = useState<Record<string, string>>(
    () => Object.fromEntries(editableCols.map((c) => [c.key, c.getValue(row)]))
  );
  const [pendingToggle, setPendingToggle] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isDirty = editableCols.some((c) => {
    const current = editValues[c.key] ?? c.getValue(row);
    const valid = c.isValid ? c.isValid(current) : current.trim() !== '';
    return valid && current !== c.getValue(row);
  });

  async function handleSave() {
    if (!isDirty || saving) return;
    const payload: Record<string, unknown> = {};
    for (const col of editableCols) {
      const current = editValues[col.key] ?? col.getValue(row);
      if (current !== col.getValue(row)) {
        Object.assign(payload, col.buildPayload(current));
      }
    }
    setSaving(true);
    try {
      await onUpdate(payload);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(col: ToggleColumn<T>) {
    if (pendingToggle || disabled) return;
    setPendingToggle(col.key);
    try {
      await onUpdate(col.buildPayload(row));
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
          const value = editValues[col.key] ?? col.getValue(row);
          return (
            <td key={col.key} className={cn('px-2 py-2', align)}>
              <div className="flex items-center gap-1.5">
                <input
                  value={value}
                  onChange={(e) => setEditValues((prev) => ({ ...prev, [col.key]: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                  disabled={disabled || saving}
                  className={cn(
                    'min-w-0 flex-1 cursor-text rounded-md border border-[rgba(255,255,255,0.12)]',
                    'bg-[rgba(255,255,255,0.05)] px-2.5 py-1.5 text-[14px] text-[#ececea] outline-none',
                    'transition-colors duration-150',
                    'hover:border-[rgba(255,255,255,0.22)] hover:bg-[rgba(255,255,255,0.08)]',
                    'focus:border-[rgba(201,112,64,0.55)] focus:bg-[rgba(255,255,255,0.08)]',
                    'disabled:cursor-not-allowed disabled:opacity-50'
                  )}
                />
                <PenIcon />
              </div>
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

      {/* Save button cell */}
      <td className="px-2 py-2.5 text-right">
        {isDirty && (
          <button
            onClick={handleSave}
            disabled={saving}
            className={cn(
              'rounded px-2.5 py-1 text-[11px] font-semibold transition-colors',
              'bg-[var(--color-brand)] text-white hover:bg-[var(--color-brand-hover)]',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {saving ? '…' : 'Save'}
          </button>
        )}
      </td>
    </tr>
  );
}

function PenIcon() {
  return (
    <svg
      width="11" height="11" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true"
      className="flex-shrink-0 text-[#737373] opacity-50"
    >
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

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

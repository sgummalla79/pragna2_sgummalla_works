interface Props {
  label: string;
  /** When true, render a thin divider in place of the label — section
   *  headers don't fit in icon-only width, but the visual break still
   *  helps users see grouping. */
  collapsed?: boolean;
}

/**
 * Non-clickable group header that labels a cluster of nav items.
 * Expanded: small uppercase caption. Collapsed: thin horizontal rule.
 */
export function SidebarSection({ label, collapsed = false }: Props) {
  if (collapsed) {
    return (
      <hr
        aria-label={label}
        className="mx-2 my-2 h-px border-0 bg-border"
      />
    );
  }
  return (
    <p className="select-none px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/70">
      {label}
    </p>
  );
}

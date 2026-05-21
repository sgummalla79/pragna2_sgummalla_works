interface Props {
  label: string;
}

/**
 * Non-clickable group header that labels a cluster of nav items.
 * Rendered as a small uppercase caption to visually separate groups.
 */
export function SidebarSection({ label }: Props) {
  return (
    <p className="select-none px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-[0.08em] text-white/40">
      {label}
    </p>
  );
}

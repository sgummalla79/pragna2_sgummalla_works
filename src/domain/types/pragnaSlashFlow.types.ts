/**
 * A slash-exposed flow the authenticated user can invoke via
 * ``POST /pragna/flows/{slash_api_name}``. Returned by
 * ``GET /pragna/flows`` for the slash-command popover.
 *
 * "Slash flow" replaces the legacy "skill" concept after the
 * skills-collapse refactor (see
 * ~/.claude/plans/collapse-skills-and-rename-pragna-routes.md). The
 * underlying entity is a Flow with ``exposed_as_slash=true``; this
 * type carries only the fields the FE needs to render the popover
 * and route the dispatch.
 */
export interface PragnaSlashFlow {
  /** The /slash command. URL-safe; same value used in the POST path. */
  slash_api_name: string;
  /** Human-readable label rendered in the popover. */
  display_name: string;
  /** Free-form description shown in the popover hint row. May be empty. */
  description: string;
}

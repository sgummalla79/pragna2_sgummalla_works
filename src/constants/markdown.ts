/**
 * Markdown-rendering configuration for the chat surface.
 *
 * Centralised here rather than inlined in the renderer so the values can
 * change without touching component logic (no hardcoded literals in
 * presentation code).
 */
import type { ControlsConfig } from 'streamdown';

/**
 * Shiki syntax-highlighting themes as a ``[light, dark]`` tuple.
 *
 * The app is currently light-only (single ``:root`` token set); the dark
 * entry is supplied for forward-compat with a future ``.dark`` theme and
 * is inert until one exists. Both names are valid Shiki ``BundledTheme``
 * members — kept as ``as const`` so they satisfy that literal-union type
 * without importing from the transitive ``shiki`` package.
 */
export const SHIKI_THEME_LIGHT = 'github-light' as const;
export const SHIKI_THEME_DARK = 'github-dark' as const;

/** ``[light, dark]`` tuple shape Streamdown's ``shikiTheme`` prop expects. */
export const SHIKI_THEMES: [typeof SHIKI_THEME_LIGHT, typeof SHIKI_THEME_DARK] = [
  SHIKI_THEME_LIGHT,
  SHIKI_THEME_DARK,
];

/**
 * Streamdown interaction controls.
 *
 * ``mermaid.panZoom: true`` keeps wheel pan/zoom on the diagram. The raw
 * wheel-zoom is far too fast (Streamdown zooms a fixed step per tick with no
 * speed prop), so ``MarkdownMessage`` throttles the wheel events feeding it —
 * see ``MERMAID_ZOOM_WHEEL_THROTTLE`` there. Fullscreen / copy / download and
 * the table + code controls stay on too.
 */
export const STREAMDOWN_CONTROLS: ControlsConfig = {
  table: true,
  code: true,
  mermaid: { panZoom: true, fullscreen: true, copy: true, download: true },
};

/**
 * Smooth-streaming reveal cadence (claude.ai / ChatGPT-style typing flow).
 *
 * The BE delivers assistant text in uneven bursts — often a few large
 * chunks (it calls the LLM non-streaming), not a steady token trickle.
 * Rendering each chunk the instant it lands reads as a chunky flash.
 * ``useSmoothStreamingText`` instead "types" the accumulated text at a
 * steady rate while bounding how far it may lag behind the buffer:
 *
 * - ``STREAM_REVEAL_BASE_CPS`` — the steady typing speed (characters per
 *   second) used whenever the backlog is small. This is the speed the eye
 *   reads as "smooth."
 * - ``STREAM_REVEAL_MAX_LAG_SECONDS`` — the longest the reveal is allowed
 *   to trail the buffer. When a big chunk lands, the rate rises just enough
 *   to clear the backlog within this window (``backlog / MAX_LAG``), so a
 *   long reply never feels stuck yet still animates instead of snapping.
 *   Effective rate = ``max(BASE_CPS, backlog / MAX_LAG_SECONDS)``.
 *
 * Raise BASE for faster typing; raise MAX_LAG for a gentler reveal of large
 * replies (more smoothing, more total delay); lower it to hug the stream.
 */
export const STREAM_REVEAL_BASE_CPS = 25;
export const STREAM_REVEAL_MAX_LAG_SECONDS = 3.5;

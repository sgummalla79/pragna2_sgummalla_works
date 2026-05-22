import { create } from 'zustand';
import {
  applyPalette,
  resetPaletteOverrides,
} from '@/themes/tweakcn';
import {
  getPalette,
  readActivePaletteId,
  writeActivePaletteId,
} from '@/themes/registry';

export type Theme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'pragna:theme';

function readInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return stored === 'light' ? 'light' : 'dark';
}

/** Apply the active palette + mode to the DOM. Called on boot and on
 *  every theme / palette change. */
function applyActive(theme: Theme, paletteId: string): void {
  const palette = getPalette(paletteId);
  applyPalette(palette, theme);
}

// Apply the persisted theme + palette before React mounts so the
// first paint matches the user's last preference (no FOUC).
const initialTheme = readInitialTheme();
const initialPaletteId = readActivePaletteId();
applyActive(initialTheme, initialPaletteId);

interface UiState {
  activeNavItem: string;
  /** Collapsed state of the chat-page secondary pane (ChatSidebar). */
  chatPaneCollapsed: boolean;
  /** Active light/dark mode. Both modes are defined per palette in
   *  :file:`src/themes/*.ts` and applied at runtime via the TweakCN
   *  translator. */
  theme: Theme;
  /** Active palette id — bundled or installed. Default ``claude``. */
  paletteId: string;
  setActiveNavItem: (item: string) => void;
  toggleChatPane: () => void;
  setChatPaneCollapsed: (value: boolean) => void;
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
  /** Switch the active palette. Persists + applies immediately. */
  setPaletteId: (id: string) => void;
  /** Re-run the palette applier — handy after installing or
   *  uninstalling a palette from the Settings → Appearance dialog. */
  refreshPalette: () => void;
}

export const useUiStore = create<UiState>((set, get) => ({
  activeNavItem: '',
  chatPaneCollapsed: false,
  theme: initialTheme,
  paletteId: initialPaletteId,

  setActiveNavItem: (activeNavItem) => set({ activeNavItem }),
  toggleChatPane: () => set((s) => ({ chatPaneCollapsed: !s.chatPaneCollapsed })),
  setChatPaneCollapsed: (chatPaneCollapsed) => set({ chatPaneCollapsed }),

  toggleTheme: () =>
    set((s) => {
      const next: Theme = s.theme === 'dark' ? 'light' : 'dark';
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(THEME_STORAGE_KEY, next);
      }
      applyActive(next, s.paletteId);
      return { theme: next };
    }),

  setTheme: (theme) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    }
    applyActive(theme, get().paletteId);
    set({ theme });
  },

  setPaletteId: (id) => {
    writeActivePaletteId(id);
    applyActive(get().theme, id);
    set({ paletteId: id });
  },

  refreshPalette: () => {
    // Resolve again — if the active palette was uninstalled, getPalette
    // falls back to the bundled default; reflect that in state.
    resetPaletteOverrides();
    const s = get();
    const palette = getPalette(s.paletteId);
    applyPalette(palette, s.theme);
    if (palette.id !== s.paletteId) {
      writeActivePaletteId(palette.id);
      set({ paletteId: palette.id });
    }
  },
}));

import { create } from 'zustand';

export type Theme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'pragna:theme';

function readInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return stored === 'light' ? 'light' : 'dark';
}

function applyTheme(t: Theme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = t;
}

// Apply persisted theme at module load so the first paint matches the
// user's last preference (no flash). The store still owns the value so
// React can subscribe to changes.
const initialTheme = readInitialTheme();
applyTheme(initialTheme);

interface UiState {
  activeNavItem: string;
  /** Collapsed state of the chat-page secondary pane (ChatSidebar). */
  chatPaneCollapsed: boolean;
  /**
   * Active colour theme. Toggled from the avatar menu.
   *
   * **Note:** the CSS for ``[data-theme=light]`` is not yet defined —
   * toggling currently only flips the attribute on ``<html>`` and the
   * stored value. A light palette is tracked in FUTURE_ENHANCEMENTS.
   */
  theme: Theme;
  setActiveNavItem: (item: string) => void;
  toggleChatPane: () => void;
  setChatPaneCollapsed: (value: boolean) => void;
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
}

export const useUiStore = create<UiState>((set) => ({
  activeNavItem: '',
  chatPaneCollapsed: false,
  theme: initialTheme,
  setActiveNavItem: (activeNavItem) => set({ activeNavItem }),
  toggleChatPane: () => set((s) => ({ chatPaneCollapsed: !s.chatPaneCollapsed })),
  setChatPaneCollapsed: (chatPaneCollapsed) => set({ chatPaneCollapsed }),
  toggleTheme: () =>
    set((s) => {
      const next: Theme = s.theme === 'dark' ? 'light' : 'dark';
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(THEME_STORAGE_KEY, next);
      }
      applyTheme(next);
      return { theme: next };
    }),
  setTheme: (theme) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    }
    applyTheme(theme);
    set({ theme });
  },
}));

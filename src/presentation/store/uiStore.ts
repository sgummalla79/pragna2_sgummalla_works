import { create } from 'zustand';

interface UiState {
  sidebarCollapsed: boolean;
  activeNavItem: string;
  toggleSidebar: () => void;
  setSidebarCollapsed: (value: boolean) => void;
  setActiveNavItem: (item: string) => void;
}

export const useUiStore = create<UiState>((set) => ({
  sidebarCollapsed: false,
  activeNavItem: '',
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
  setActiveNavItem: (activeNavItem) => set({ activeNavItem }),
}));

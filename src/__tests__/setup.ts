import '@testing-library/jest-dom';
import { vi } from 'vitest';

vi.mock('@/assets/logo.svg?react', () => ({
  default: () => null,
}));

// React Flow (used by the visual flow editor) measures the DOM via
// ResizeObserver, which jsdom doesn't implement. A no-op polyfill lets
// its components mount in component tests.
if (!('ResizeObserver' in globalThis)) {
  class ResizeObserverStub {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}

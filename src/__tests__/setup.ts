import '@testing-library/jest-dom';
import { vi } from 'vitest';

vi.mock('@/assets/logo.svg?react', () => ({
  default: () => null,
}));

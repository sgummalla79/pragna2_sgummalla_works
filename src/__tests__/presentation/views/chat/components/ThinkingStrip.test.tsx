import { describe, it, expect } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { ThinkingStrip } from '@/presentation/views/chat/components/ThinkingStrip';

describe('ThinkingStrip (persistent Pragna indicator)', () => {
  it('renders the logo even when label is null (idle "ready" state)', () => {
    render(<ThinkingStrip label={null} />);
    const strip = screen.getByTestId('thinking-strip');
    expect(strip).toBeInTheDocument();
    // No label text in idle state.
    expect(strip.textContent).toBe('');
    // Idle aria-label signals readiness, not in-progress work.
    expect(strip).toHaveAttribute('aria-label', 'Ready for your next message');
  });

  it('renders the label when supplied', () => {
    render(<ThinkingStrip label="Researching pricing data..." />);
    expect(screen.getByText('Researching pricing data...')).toBeInTheDocument();
    expect(screen.getByTestId('thinking-strip')).toBeInTheDocument();
  });

  it('updates the label when the prop changes', () => {
    const { rerender } = render(<ThinkingStrip label="Researching..." />);
    expect(screen.getByText('Researching...')).toBeInTheDocument();
    rerender(<ThinkingStrip label="Drafting response..." />);
    expect(screen.getByText('Drafting response...')).toBeInTheDocument();
    expect(screen.queryByText('Researching...')).not.toBeInTheDocument();
  });

  it('exposes status role + aria-live for screen readers', () => {
    render(<ThinkingStrip label="Thinking..." />);
    const strip = screen.getByTestId('thinking-strip');
    expect(strip).toHaveAttribute('role', 'status');
    expect(strip).toHaveAttribute('aria-live', 'polite');
    expect(strip).toHaveAttribute(
      'aria-label',
      'Agent status: Thinking...',
    );
  });

  it('stays mounted and collapses to idle when label flips to null', async () => {
    const { rerender } = render(<ThinkingStrip label="Working..." />);
    expect(screen.getByText('Working...')).toBeInTheDocument();

    rerender(<ThinkingStrip label={null} />);

    // Strip is still mounted (it's the persistent indicator now).
    expect(screen.getByTestId('thinking-strip')).toBeInTheDocument();

    // After the fade-out window, the label text drops out, leaving
    // just the static logo + idle aria-label.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 250));
    });

    expect(screen.queryByText('Working...')).not.toBeInTheDocument();
    expect(screen.getByTestId('thinking-strip')).toHaveAttribute(
      'aria-label',
      'Ready for your next message',
    );
  });
});

import { describe, it, expect } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { ThinkingStrip } from '@/presentation/views/chat/components/ThinkingStrip';

describe('ThinkingStrip (R7.1#3 follow-up)', () => {
  it('renders nothing when label is null', () => {
    const { container } = render(<ThinkingStrip label={null} />);
    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId('thinking-strip')).not.toBeInTheDocument();
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

  it('unmounts (returns null) after the fade-out timer when label flips to null', async () => {
    const { rerender, container } = render(
      <ThinkingStrip label="Working..." />,
    );
    expect(container.firstChild).not.toBeNull();

    // Flip to null — strip fades, then unmounts after the 220ms timer.
    rerender(<ThinkingStrip label={null} />);

    // Still mounted during the fade window (we render at opacity-0
    // briefly so transitionend can fire).
    expect(container.firstChild).not.toBeNull();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 250));
    });

    expect(container.firstChild).toBeNull();
  });
});

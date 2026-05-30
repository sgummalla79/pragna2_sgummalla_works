import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReasoningPanel } from '@/presentation/views/chat/components/ReasoningPanel';

const REASONING =
  'The user is asking about mandatory tools for hallucination-free ' +
  'technical research agents with human-in-the-loop capabilities.\n' +
  'Second line of the trace.';

describe('ReasoningPanel (BE migration 0026)', () => {
  it('renders collapsed by default showing a one-line summary, not the full trace', () => {
    render(<ReasoningPanel reasoning={REASONING} />);
    // Collapsed: the trigger advertises a non-expanded state.
    expect(screen.getByRole('button')).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    // The second line of the trace is hidden until expanded.
    expect(screen.queryByText(/Second line of the trace/)).not.toBeInTheDocument();
    // No Done node while collapsed.
    expect(screen.queryByText('Done')).not.toBeInTheDocument();
  });

  it('expands on click to reveal the full trace and the Done node', async () => {
    const user = userEvent.setup();
    render(<ReasoningPanel reasoning={REASONING} />);
    await user.click(screen.getByRole('button'));
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/Second line of the trace/)).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
  });

  it('mounts expanded when defaultOpen is set (streaming surface)', () => {
    render(<ReasoningPanel reasoning={REASONING} defaultOpen />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Done')).toBeInTheDocument();
  });
});

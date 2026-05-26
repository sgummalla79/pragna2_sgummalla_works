import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HITLFormCard } from '@/presentation/views/chat/components/HITLFormCard';
import type { AskUserSchema } from '@/presentation/views/chat/components/form/validators';

function baseSchema(): AskUserSchema {
  return {
    fields: [
      { name: 'comment', type: 'text', label: 'Comment', required: false },
    ],
    allow_text_input: false,
    submit_label: undefined,
  };
}

function renderCard(overrides: {
  onCancel?: () => void;
  cancelling?: boolean;
} = {}) {
  const onSubmit = vi.fn();
  const onValuesChange = vi.fn();
  const onTouchedChange = vi.fn();
  const utils = render(
    <HITLFormCard
      schema={baseSchema()}
      values={{}}
      onValuesChange={onValuesChange}
      textValue=""
      touched={{}}
      onTouchedChange={onTouchedChange}
      onSubmit={onSubmit}
      onCancel={overrides.onCancel}
      cancelling={overrides.cancelling}
    />,
  );
  return { ...utils, onSubmit };
}

describe('HITLFormCard cancel affordance (R7.1#3)', () => {
  it('omits the Cancel button when onCancel is not provided', () => {
    renderCard({});
    // Submit is always present; Cancel only when onCancel is wired.
    expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /^cancel$/i }),
    ).not.toBeInTheDocument();
  });

  it('renders the Cancel button when onCancel is provided', () => {
    renderCard({ onCancel: vi.fn() });
    expect(
      screen.getByRole('button', { name: /^cancel$/i }),
    ).toBeInTheDocument();
  });

  it('opens a confirm dialog on Cancel click — not a direct mutation', () => {
    const onCancel = vi.fn();
    renderCard({ onCancel });
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    // Dialog opens with destructive copy + a "Keep editing" out.
    expect(
      screen.getByRole('button', { name: /keep editing/i }),
    ).toBeInTheDocument();
    // onCancel is NOT called yet — the user must confirm.
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('fires onCancel only after the user confirms the dialog', () => {
    const onCancel = vi.fn();
    renderCard({ onCancel });
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    fireEvent.click(screen.getByRole('button', { name: /cancel episode/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('disables the Cancel button while a cancel mutation is in flight', () => {
    renderCard({ onCancel: vi.fn(), cancelling: true });
    const cancelBtn = screen.getByRole('button', { name: /cancelling/i });
    expect(cancelBtn).toBeDisabled();
  });
});

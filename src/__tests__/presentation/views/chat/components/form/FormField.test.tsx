import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FormField } from '@/presentation/views/chat/components/form/FormField';
import type { AskUserField } from '@/presentation/views/chat/components/form/validators';
import {
  ServiceContext,
  type Services,
} from '@/presentation/providers/ServiceContext';

function renderField(opts: {
  field: AskUserField;
  value: unknown;
  onChange?: (next: unknown) => void;
  disabled?: boolean;
  error?: string | null;
  uploadContext?: { conversationId: string };
  uploadImpl?: (conversationId: string, file: File) => Promise<unknown>;
}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onChange = opts.onChange ?? vi.fn();
  // attachmentService.upload is called positionally: (conversationId, file)
  // — see useUploadAttachment.
  const upload = vi.fn(
    opts.uploadImpl ??
      ((_cid: string, _file: File) =>
        Promise.resolve({ id: 'att-1', filename: 'file.docx' })),
  );
  const services = {
    attachmentService: { upload },
  } as unknown as Services;
  const utils = render(
    <QueryClientProvider client={qc}>
      <ServiceContext.Provider value={services}>
        <FormField
          field={opts.field}
          value={opts.value}
          onChange={onChange}
          disabled={opts.disabled}
          error={opts.error ?? null}
          uploadContext={opts.uploadContext}
        />
      </ServiceContext.Provider>
    </QueryClientProvider>,
  );
  return { ...utils, onChange, upload };
}

describe('FormField — R7 date field', () => {
  it('renders a native date input and forwards the value', () => {
    renderField({
      field: { name: 'd', type: 'date', label: 'Pick a date', required: false } as AskUserField,
      value: '2026-05-24',
    });
    const input = screen.getByLabelText(/pick a date/i) as HTMLInputElement;
    expect(input.type).toBe('date');
    expect(input.value).toBe('2026-05-24');
  });

  it('emits the new ISO string on change', () => {
    const onChange = vi.fn();
    renderField({
      field: { name: 'd', type: 'date', label: 'D', required: false } as AskUserField,
      value: '',
      onChange,
    });
    const input = screen.getByLabelText(/d/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '2026-06-15' } });
    expect(onChange).toHaveBeenCalledWith('2026-06-15');
  });
});

describe('FormField — R7 daterange field', () => {
  it('renders two coupled date inputs', () => {
    renderField({
      field: { name: 'r', type: 'daterange', label: 'Range', required: false } as AskUserField,
      value: { start: '2026-05-01', end: '2026-05-24' },
    });
    expect(screen.getByLabelText(/range \(start\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/range \(end\)/i)).toBeInTheDocument();
  });

  it('emits the merged {start, end} object when only one half changes', () => {
    const onChange = vi.fn();
    renderField({
      field: { name: 'r', type: 'daterange', label: 'Range', required: false } as AskUserField,
      value: { start: '2026-05-01', end: '' },
      onChange,
    });
    const endInput = screen.getByLabelText(/range \(end\)/i) as HTMLInputElement;
    fireEvent.change(endInput, { target: { value: '2026-05-24' } });
    expect(onChange).toHaveBeenCalledWith({ start: '2026-05-01', end: '2026-05-24' });
  });

  it("mirrors the start date into the end input's min so end can't precede start", () => {
    renderField({
      field: { name: 'r', type: 'daterange', label: 'Range', required: false } as AskUserField,
      value: { start: '2026-05-10', end: '' },
    });
    const endInput = screen.getByLabelText(/range \(end\)/i) as HTMLInputElement;
    expect(endInput.min).toBe('2026-05-10');
  });
});

describe('FormField — R7 file field', () => {
  it('shows a "becomes available once initialised" hint when uploadContext is absent', () => {
    renderField({
      field: { name: 'f', type: 'file', label: 'File', required: false } as AskUserField,
      value: '',
      // uploadContext intentionally absent — brand-new chat without a
      // materialised conversation row.
    });
    expect(
      screen.getByText(/file upload becomes available once the chat is initialised/i),
    ).toBeInTheDocument();
  });

  it('renders a Choose file button when uploadContext is present and value is empty', () => {
    renderField({
      field: { name: 'f', type: 'file', label: 'File', required: false } as AskUserField,
      value: '',
      uploadContext: { conversationId: 'conv-1' },
    });
    expect(
      screen.getByRole('button', { name: /choose file/i }),
    ).toBeInTheDocument();
  });

  it('renders a chip with the attachment id when value is populated, plus a remove button', () => {
    renderField({
      field: { name: 'f', type: 'file', label: 'File', required: false } as AskUserField,
      value: 'att-1',
      uploadContext: { conversationId: 'conv-1' },
    });
    // The chip shows the attachment id as a fallback when no filename
    // is locally cached (e.g. after a page reload).
    expect(screen.getByText('att-1')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /remove file/i }),
    ).toBeInTheDocument();
  });

  it("clears the value via onChange('') when the remove × is clicked", () => {
    const onChange = vi.fn();
    renderField({
      field: { name: 'f', type: 'file', label: 'File', required: false } as AskUserField,
      value: 'att-1',
      onChange,
      uploadContext: { conversationId: 'conv-1' },
    });
    fireEvent.click(screen.getByRole('button', { name: /remove file/i }));
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('uploads the picked file and emits the attachment id on success', async () => {
    const onChange = vi.fn();
    const upload = vi.fn((_cid: string, _file: File) =>
      Promise.resolve({ id: 'att-uploaded', filename: 'report.docx' }),
    );
    renderField({
      field: { name: 'f', type: 'file', label: 'File', required: false } as AskUserField,
      value: '',
      onChange,
      uploadContext: { conversationId: 'conv-1' },
      uploadImpl: upload,
    });
    // Locate the hidden file input directly (the visible "Choose file"
    // button proxies clicks to it via ref).
    const hiddenInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(hiddenInput).not.toBeNull();
    const file = new File(['hello'], 'report.docx', { type: 'text/plain' });
    fireEvent.change(hiddenInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(upload).toHaveBeenCalledWith('conv-1', file);
      expect(onChange).toHaveBeenCalledWith('att-uploaded');
    });
  });
});

import { Button } from '@/presentation/components/ui/Button';
import { Input } from '@/presentation/components/ui/Input';
import { PasswordInput } from '@/presentation/components/ui/PasswordInput';
import { Textarea } from '@/presentation/components/ui/Textarea';
import { CREDENTIAL_FIELDS } from '@/constants/providers';
import type { CredentialKind } from '@/domain/types/provider.types';

interface ProviderConnectFormProps {
  credentialKind: CredentialKind;
  values: Record<string, string>;
  onValuesChange: (key: string, value: string) => void;
  error: string;
  connecting: boolean;
  onConnect: () => void;
}

/**
 * Form shown inside the provider modal when a provider is not yet connected.
 *
 * Fields are driven entirely by the CREDENTIAL_FIELDS JSON config.
 * No separate labels — the field label is used as the input placeholder.
 * A short hint below each field guides the user on what to enter.
 *
 * To add or change a field, update constants/providers.ts only.
 */
export function ProviderConnectForm({
  credentialKind,
  values,
  onValuesChange,
  error,
  connecting,
  onConnect,
}: ProviderConnectFormProps) {
  const fields = CREDENTIAL_FIELDS[credentialKind];

  return (
    <div className="flex flex-col gap-4">
      {fields.map((field) => (
        <div key={field.key} className="flex flex-col gap-1.5">
          {field.multiline ? (
            <Textarea
              id={field.key}
              placeholder={field.label}
              aria-label={field.label}
              value={values[field.key] ?? ''}
              onChange={(e) => onValuesChange(field.key, e.target.value)}
              rows={5}
              className={error ? 'border-destructive' : undefined}
            />
          ) : field.secret ? (
            <PasswordInput
              id={field.key}
              placeholder={field.label}
              aria-label={field.label}
              value={values[field.key] ?? ''}
              onChange={(e) => onValuesChange(field.key, e.target.value)}
              autoComplete="off"
              className={error ? 'border-destructive' : undefined}
            />
          ) : (
            <Input
              id={field.key}
              placeholder={field.label}
              aria-label={field.label}
              value={values[field.key] ?? ''}
              onChange={(e) => onValuesChange(field.key, e.target.value)}
              className={error ? 'border-destructive' : undefined}
            />
          )}

          {/* Hint — example value + short guidance from the config */}
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {field.placeholder && (
              <span className="font-mono text-muted-foreground">
                {field.placeholder}
              </span>
            )}
            {field.placeholder && field.hint && '  ·  '}
            {field.hint}
          </p>
        </div>
      ))}

      {error && (
        <p role="alert" className="text-[13px] text-[var(--color-error-text)]">
          {error}
        </p>
      )}

      <Button
        onClick={onConnect}
        disabled={connecting}
        aria-busy={connecting}
        className="w-full"
      >
        {connecting ? 'Connecting…' : 'Connect'}
      </Button>
    </div>
  );
}

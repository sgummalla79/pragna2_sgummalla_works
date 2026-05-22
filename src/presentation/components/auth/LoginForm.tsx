import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';

import PragnaLogo from '@/assets/logo.svg?react';
import { APP_NAME } from '@/constants/api';
import { ERRORS } from '@/constants/errors';
import { ROUTES } from '@/constants/routes';
import { useAuth } from '@/presentation/hooks/auth/useAuth';
import { useAuth0Connections } from '@/presentation/hooks/auth/useAuth0Connections';
import { SocialLoginButton } from '@/presentation/views/auth/SocialLoginButton';
import { Button } from '@/presentation/components/ui/Button';
import { Input } from '@/presentation/components/ui/Input';
import { PasswordInput } from '@/presentation/components/ui/PasswordInput';

/**
 * Self-contained login card. Brand header + form + social options +
 * register link. Every surface (background, border, text, hover) reads
 * from the active palette via Tailwind tokens — no inline colour
 * styles, no JS-driven hover handlers.
 */
export function LoginForm() {
  const { login, initiateSocialLogin } = useAuth();
  const { data: connections, isLoading: connectionsLoading } = useAuth0Connections();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);

  const busy = loading || socialLoading !== null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!email || !password) {
      setError('Email and password are required.');
      return;
    }
    setLoading(true);
    try {
      await login({ email, password });
    } catch {
      setError(ERRORS.AUTH_007.message);
    } finally {
      setLoading(false);
    }
  }

  function handleSocialLogin(connection: string) {
    setError('');
    setSocialLoading(connection);
    // initiates a full-page redirect — page navigates away, no return value
    initiateSocialLogin(connection);
  }

  return (
    <div className="w-full max-w-[380px] flex flex-col gap-[18px] rounded-2xl border border-border bg-popover text-popover-foreground p-9 shadow-2xl">
      {/* Brand — logo + app name */}
      <div className="flex flex-col items-center gap-2.5 pb-2">
        <PragnaLogo className="h-16 w-16" aria-hidden="true" />
        <span className="text-[32px] font-bold leading-none tracking-tight text-foreground">
          {APP_NAME}
        </span>
      </div>

      {/* Error banner */}
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-[var(--color-error-border)] bg-[var(--color-error-bg)] px-3 py-2.5 text-[13px] text-[var(--color-error-text)]"
        >
          <AlertCircle size={14} className="mt-[1px] flex-shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}

      {/* Email / password form */}
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-2.5">
        <Input
          type="email"
          autoComplete="email"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-label="Email address"
          aria-required="true"
          disabled={busy}
        />

        <PasswordInput
          autoComplete="current-password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-label="Password"
          aria-required="true"
          disabled={busy}
        />

        <Button
          type="submit"
          disabled={busy}
          aria-busy={loading}
          className="w-full mt-1"
        >
          {loading ? (
            <>
              <span
                aria-hidden="true"
                className="inline-block h-3.5 w-3.5 rounded-full border-2 border-[color-mix(in_oklab,var(--color-primary-foreground)_30%,transparent)] border-t-primary-foreground animate-spin"
              />
              Signing in…
            </>
          ) : (
            'Sign in'
          )}
        </Button>
      </form>

      {/* Divider */}
      <div className="flex items-center gap-2.5 text-[12px] text-muted-foreground">
        <span className="flex-1 h-px bg-border" />
        or
        <span className="flex-1 h-px bg-border" />
      </div>

      {/* Social connections */}
      <div className="flex flex-col gap-2">
        {connectionsLoading && (
          <p className="text-center text-[13px] text-muted-foreground py-2">
            Loading sign-in options…
          </p>
        )}

        {!connectionsLoading && connections?.map((conn) => (
          <SocialLoginButton
            key={conn.name}
            connection={conn}
            loading={socialLoading === conn.name}
            disabled={busy}
            onClick={() => handleSocialLogin(conn.name)}
          />
        ))}
      </div>

      {/* Register link */}
      <p className="text-center text-[13px] text-muted-foreground mt-1">
        No account?{' '}
        <Link
          to={ROUTES.REGISTER}
          className="font-medium text-primary no-underline hover:underline"
        >
          Create one
        </Link>
      </p>
    </div>
  );
}

import { useState, type FormEvent } from 'react';
import PragnaLogo from '@/assets/logo.svg?react';
import { APP_NAME } from '@/constants/api';
import { ERRORS } from '@/constants/errors';
import { ROUTES } from '@/constants/routes';
import { Link } from 'react-router-dom';
import { useAuth } from '@/presentation/hooks/auth/useAuth';
import { useAuth0Connections } from '@/presentation/hooks/auth/useAuth0Connections';
import { SocialLoginButton } from '@/presentation/views/LoginView/SocialLoginButton';
import { Input } from '@/presentation/components/ui/Input';
import { PasswordInput } from '@/presentation/components/ui/PasswordInput';

/**
 * Self-contained login card.
 * Contains everything — brand header, form, divider, social connections.
 * Parent (LoginView) is a plain centring shell.
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
    <div
      className="w-full flex flex-col gap-[18px]"
      style={{
        maxWidth: 380,
        background: '#212121',
        border: '1px solid rgba(255,255,255,0.09)',
        borderRadius: 16,
        padding: '36px 32px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.45)',
      }}
    >
      {/* Brand — logo + app name */}
      <div className="flex flex-col items-center gap-[10px] pb-2">
        <PragnaLogo className="h-16 w-16" aria-hidden="true" />
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 32,
            fontWeight: 700,
            color: '#ececea',
            letterSpacing: '-0.5px',
            lineHeight: 1,
          }}
        >
          {APP_NAME}
        </span>
      </div>

      {/* Error */}
      {error && (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
            background: '#1f0d0d',
            border: '1px solid #4a1a1a',
            borderRadius: 8,
            padding: '10px 12px',
            fontSize: 13,
            color: '#fca5a5',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true">
            <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
            <path d="M8 5v3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="8" cy="11" r=".75" fill="currentColor" />
          </svg>
          {error}
        </div>
      )}

      {/* Email / password form */}
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-[10px]">
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

        <button
          type="submit"
          disabled={busy}
          aria-busy={loading}
          style={{
            width: '100%',
            padding: '10px 16px',
            borderRadius: 8,
            border: 'none',
            fontSize: 14,
            fontWeight: 600,
            cursor: busy ? 'not-allowed' : 'pointer',
            opacity: busy ? 0.5 : 1,
            background: '#c97040',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          {loading ? (
            <>
              <span
                style={{
                  width: 14, height: 14, borderRadius: '50%',
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: '#fff',
                  animation: 'spin 0.6s linear infinite',
                  display: 'inline-block',
                }}
                aria-hidden="true"
              />
              Signing in…
            </>
          ) : (
            'Sign in'
          )}
        </button>
      </form>

      {/* Divider */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#737373', fontSize: 12 }}>
        <span style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.09)' }} />
        or
        <span style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.09)' }} />
      </div>

      {/* Social connections */}
      <div className="flex flex-col gap-[8px]">
        {connectionsLoading && (
          <p style={{ fontSize: 13, color: '#737373', textAlign: 'center', padding: '8px 0' }}>
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
      <p style={{ fontSize: 13, color: '#737373', textAlign: 'center', marginTop: 4 }}>
        No account?{' '}
        <Link
          to={ROUTES.REGISTER}
          style={{ color: '#c97040', textDecoration: 'none', fontWeight: 500 }}
          onMouseEnter={(e) => { (e.target as HTMLAnchorElement).style.textDecoration = 'underline'; }}
          onMouseLeave={(e) => { (e.target as HTMLAnchorElement).style.textDecoration = 'none'; }}
        >
          Create one
        </Link>
      </p>
    </div>
  );
}

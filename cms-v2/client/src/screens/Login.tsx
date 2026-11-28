import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, canManageContent, setCurrentUser, type AccessLevel, type CurrentUser } from '../api/client';
import TurnstileField, { resetTurnstile } from '../components/TurnstileField';

type LoginResult = {
  user?: CurrentUser;
  totpRequired?: boolean;
  totpSetupRequired?: boolean;
  loginTicket?: string;
  totpSecret?: string;
  otpauthUrl?: string;
};

type Step =
  | { kind: 'password' }
  | { kind: 'code'; ticket: string; secret?: string; otpauthUrl?: string };

function homeFor(role: AccessLevel): string {
  if (role === 'analyst') return '/tracking';
  return canManageContent(role) ? '/content-migration' : '/content-migration?tab=global';
}

function groupSecret(secret: string): string {
  return secret.replace(/(.{4})/g, '$1 ').trim();
}

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [mode, setMode] = useState<'login' | 'forgot'>('login');
  const [step, setStep] = useState<Step>({ kind: 'password' });
  const [code, setCode] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  function finish(user: CurrentUser) {
    setCurrentUser(user);
    navigate(homeFor(user.role));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!turnstileToken) {
      setError('Please complete the captcha.');
      return;
    }
    setLoading(true);
    try {
      const data = await api.post<LoginResult>('/auth/login', { username, password, turnstileToken });
      if (data.user) {
        finish(data.user);
        return;
      }
      if (data.loginTicket && (data.totpRequired || data.totpSetupRequired)) {
        setCode('');
        setStep({
          kind: 'code',
          ticket: data.loginTicket,
          secret: data.totpSetupRequired ? data.totpSecret : undefined,
          otpauthUrl: data.totpSetupRequired ? data.otpauthUrl : undefined,
        });
        return;
      }
      setError('Sign-in did not complete. Please try again.');
      resetTurnstile();
      setTurnstileToken('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
      resetTurnstile();
      setTurnstileToken('');
    } finally {
      setLoading(false);
    }
  }

  async function handleCode(e: React.FormEvent) {
    e.preventDefault();
    if (step.kind !== 'code') return;
    setError('');
    setLoading(true);
    try {
      const data = await api.post<{ user?: CurrentUser }>('/auth/totp', {
        loginTicket: step.ticket,
        totpCode: code,
      });
      if (!data.user) {
        setError('Sign-in did not complete. Please try again.');
        return;
      }
      finish(data.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That authenticator code is not valid');
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordResetRequest(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const data = await api.post<{ message: string }>('/auth/request-password-reset', { email: resetEmail });
      setMessage(data.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to request password reset');
    } finally {
      setLoading(false);
    }
  }

  function showForgotPassword() {
    setError('');
    setMessage('');
    setResetEmail(username.includes('@') ? username : resetEmail);
    setMode('forgot');
  }

  const heading = step.kind === 'code'
    ? (step.secret ? 'Set up your authenticator' : 'Enter your authenticator code')
    : (mode === 'login' ? 'Sign in to your account' : 'Reset your account password');

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl">
        <h1 className="mb-1 text-xl font-bold text-slate-900">Vertex Vault</h1>
        <p className="mb-6 text-sm text-slate-500">{heading}</p>

        {step.kind === 'code' ? (
          <form onSubmit={handleCode} className="space-y-4">
            {step.secret ? (
              <div className="space-y-2 rounded-lg bg-slate-50 px-3 py-3 text-sm text-slate-600">
                <p>Add this key to an authenticator app, then enter the 6-digit code it shows.</p>
                <p className="break-all font-mono text-sm font-semibold tracking-wide text-slate-900">{groupSecret(step.secret)}</p>
                {step.otpauthUrl ? (
                  <a className="inline-block font-medium text-brand" href={step.otpauthUrl}>Open in authenticator</a>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-slate-600">Enter the 6-digit code from your authenticator app.</p>
            )}
            <div>
              <label className="field-label">Authenticator code</label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="input tracking-widest"
                required
                autoFocus
                pattern="\d{6}"
              />
            </div>
            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
            )}
            <button type="submit" disabled={loading || code.length !== 6} className="btn-primary w-full justify-center">
              {loading ? 'Checking...' : 'Continue'}
            </button>
            <button
              type="button"
              onClick={() => {
                setError('');
                setCode('');
                setStep({ kind: 'password' });
                setTurnstileToken('');
              }}
              className="w-full text-center text-sm font-medium text-slate-500 hover:text-brand"
            >
              Back to sign in
            </button>
          </form>
        ) : mode === 'login' ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="field-label">Username or email</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="input"
                required
                autoFocus
                autoComplete="username"
              />
            </div>
            <div>
              <label className="field-label">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="input"
                required
                autoComplete="current-password"
              />
            </div>
            <TurnstileField onToken={setTurnstileToken} />

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
              {loading ? 'Signing in...' : 'Sign in'}
            </button>

            <button
              type="button"
              onClick={showForgotPassword}
              className="w-full text-center text-sm font-medium text-slate-500 hover:text-brand"
            >
              Forgot password?
            </button>
          </form>
        ) : (
          <form onSubmit={handlePasswordResetRequest} className="space-y-4">
            <div>
              <label className="field-label">Email used as username</label>
              <input
                type="email"
                value={resetEmail}
                onChange={e => setResetEmail(e.target.value)}
                className="input"
                required
                autoFocus
                autoComplete="email"
              />
            </div>

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
            )}
            {message && (
              <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{message}</p>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
              {loading ? 'Sending...' : 'Send reset link'}
            </button>

            <button
              type="button"
              onClick={() => {
                setError('');
                setMessage('');
                setMode('login');
              }}
              className="w-full text-center text-sm font-medium text-slate-500 hover:text-brand"
            >
              Back to sign in
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

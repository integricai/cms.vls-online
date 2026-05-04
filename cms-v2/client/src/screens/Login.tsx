import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setCurrentUser, setToken, type CurrentUser } from '../api/client';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [mode, setMode] = useState<'login' | 'forgot'>('login');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api.post<{ token: string; user: CurrentUser }>('/auth/login', { username, password });
      setToken(data.token);
      setCurrentUser(data.user);
      navigate('/home-hero');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl">
        <h1 className="mb-1 text-xl font-bold text-slate-900">VLS CMS</h1>
        <p className="mb-6 text-sm text-slate-500">
          {mode === 'login' ? 'Sign in to your account' : 'Reset your account password'}
        </p>

        {mode === 'login' ? (
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

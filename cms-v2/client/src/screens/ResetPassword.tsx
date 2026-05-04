import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';

type CaptchaChallenge = {
  question: string;
  token: string;
};

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') ?? '';

  const [username, setUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [captcha, setCaptcha] = useState<CaptchaChallenge | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [captchaLoading, setCaptchaLoading] = useState(false);

  async function loadCaptcha() {
    setCaptchaLoading(true);
    setCaptchaAnswer('');
    try {
      const challenge = await api.get<CaptchaChallenge>('/auth/captcha');
      setCaptcha(challenge);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load captcha');
    } finally {
      setCaptchaLoading(false);
    }
  }

  useEffect(() => {
    loadCaptcha();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!token) {
      setError('Reset link is missing or invalid.');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (!captcha) {
      setError('Captcha is still loading. Please try again.');
      return;
    }

    setLoading(true);
    try {
      const data = await api.post<{ message: string }>('/auth/reset-password', {
        token,
        username,
        newPassword,
        captchaToken: captcha.token,
        captchaAnswer,
      });
      setMessage(data.message);
      setTimeout(() => navigate('/login'), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Password reset failed');
      loadCaptcha();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl">
        <h1 className="mb-1 text-xl font-bold text-slate-900">Set new password</h1>
        <p className="mb-6 text-sm text-slate-500">Enter your username and choose a new password.</p>

        {!token && (
          <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            Reset link is missing or invalid.
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="field-label">Username</label>
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
            <label className="field-label">New password</label>
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className="input"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>

          <div>
            <label className="field-label">Confirm new password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className="input"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between gap-3">
              <label className="field-label mb-0">Captcha</label>
              <button
                type="button"
                onClick={loadCaptcha}
                disabled={captchaLoading}
                className="text-xs font-semibold text-brand hover:text-brand/80 disabled:opacity-50"
              >
                Refresh
              </button>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 min-w-24 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700">
                {captchaLoading ? 'Loading' : captcha?.question ?? 'Unavailable'}
              </div>
              <input
                type="text"
                value={captchaAnswer}
                onChange={e => setCaptchaAnswer(e.target.value)}
                className="input"
                required
                inputMode="numeric"
                autoComplete="off"
              />
            </div>
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}
          {message && (
            <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{message}</p>
          )}

          <button type="submit" disabled={loading || !token} className="btn-primary w-full justify-center">
            {loading ? 'Updating...' : 'Set new password'}
          </button>
        </form>

        <Link to="/login" className="mt-5 block text-center text-sm font-medium text-slate-500 hover:text-brand">
          Back to sign in
        </Link>
      </div>
    </div>
  );
}

import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
export default function ResetPassword() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const token = searchParams.get('token') ?? '';
    const [username, setUsername] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [captchaAnswer, setCaptchaAnswer] = useState('');
    const [captcha, setCaptcha] = useState(null);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [captchaLoading, setCaptchaLoading] = useState(false);
    async function loadCaptcha() {
        setCaptchaLoading(true);
        setCaptchaAnswer('');
        try {
            const challenge = await api.get('/auth/captcha');
            setCaptcha(challenge);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to load captcha');
        }
        finally {
            setCaptchaLoading(false);
        }
    }
    useEffect(() => {
        loadCaptcha();
    }, []);
    async function handleSubmit(e) {
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
            const data = await api.post('/auth/reset-password', {
                token,
                username,
                newPassword,
                captchaToken: captcha.token,
                captchaAnswer,
            });
            setMessage(data.message);
            setTimeout(() => navigate('/login'), 1200);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Password reset failed');
            loadCaptcha();
        }
        finally {
            setLoading(false);
        }
    }
    return (_jsx("div", { className: "flex min-h-screen items-center justify-center bg-slate-900 px-4", children: _jsxs("div", { className: "w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl", children: [_jsx("h1", { className: "mb-1 text-xl font-bold text-slate-900", children: "Set new password" }), _jsx("p", { className: "mb-6 text-sm text-slate-500", children: "Enter your username and choose a new password." }), !token && (_jsx("p", { className: "mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600", children: "Reset link is missing or invalid." })), _jsxs("form", { onSubmit: handleSubmit, className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "field-label", children: "Username" }), _jsx("input", { type: "text", value: username, onChange: e => setUsername(e.target.value), className: "input", required: true, autoFocus: true, autoComplete: "username" })] }), _jsxs("div", { children: [_jsx("label", { className: "field-label", children: "New password" }), _jsx("input", { type: "password", value: newPassword, onChange: e => setNewPassword(e.target.value), className: "input", required: true, minLength: 8, autoComplete: "new-password" })] }), _jsxs("div", { children: [_jsx("label", { className: "field-label", children: "Confirm new password" }), _jsx("input", { type: "password", value: confirmPassword, onChange: e => setConfirmPassword(e.target.value), className: "input", required: true, minLength: 8, autoComplete: "new-password" })] }), _jsxs("div", { children: [_jsxs("div", { className: "mb-1 flex items-center justify-between gap-3", children: [_jsx("label", { className: "field-label mb-0", children: "Captcha" }), _jsx("button", { type: "button", onClick: loadCaptcha, disabled: captchaLoading, className: "text-xs font-semibold text-brand hover:text-brand/80 disabled:opacity-50", children: "Refresh" })] }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "flex h-10 min-w-24 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700", children: captchaLoading ? 'Loading' : captcha?.question ?? 'Unavailable' }), _jsx("input", { type: "text", value: captchaAnswer, onChange: e => setCaptchaAnswer(e.target.value), className: "input", required: true, inputMode: "numeric", autoComplete: "off" })] })] }), error && (_jsx("p", { className: "rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600", children: error })), message && (_jsx("p", { className: "rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700", children: message })), _jsx("button", { type: "submit", disabled: loading || !token, className: "btn-primary w-full justify-center", children: loading ? 'Updating...' : 'Set new password' })] }), _jsx(Link, { to: "/login", className: "mt-5 block text-center text-sm font-medium text-slate-500 hover:text-brand", children: "Back to sign in" })] }) }));
}

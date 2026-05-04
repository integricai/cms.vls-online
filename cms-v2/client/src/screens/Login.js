import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setCurrentUser, setToken } from '../api/client';
export default function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [resetEmail, setResetEmail] = useState('');
    const [mode, setMode] = useState('login');
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    async function handleSubmit(e) {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const data = await api.post('/auth/login', { username, password });
            setToken(data.token);
            setCurrentUser(data.user);
            navigate('/home-hero');
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Login failed');
        }
        finally {
            setLoading(false);
        }
    }
    async function handlePasswordResetRequest(e) {
        e.preventDefault();
        setError('');
        setMessage('');
        setLoading(true);
        try {
            const data = await api.post('/auth/request-password-reset', { email: resetEmail });
            setMessage(data.message);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to request password reset');
        }
        finally {
            setLoading(false);
        }
    }
    function showForgotPassword() {
        setError('');
        setMessage('');
        setResetEmail(username.includes('@') ? username : resetEmail);
        setMode('forgot');
    }
    return (_jsx("div", { className: "flex min-h-screen items-center justify-center bg-slate-900 px-4", children: _jsxs("div", { className: "w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl", children: [_jsx("h1", { className: "mb-1 text-xl font-bold text-slate-900", children: "VLS CMS" }), _jsx("p", { className: "mb-6 text-sm text-slate-500", children: mode === 'login' ? 'Sign in to your account' : 'Reset your account password' }), mode === 'login' ? (_jsxs("form", { onSubmit: handleSubmit, className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "field-label", children: "Username or email" }), _jsx("input", { type: "text", value: username, onChange: e => setUsername(e.target.value), className: "input", required: true, autoFocus: true, autoComplete: "username" })] }), _jsxs("div", { children: [_jsx("label", { className: "field-label", children: "Password" }), _jsx("input", { type: "password", value: password, onChange: e => setPassword(e.target.value), className: "input", required: true, autoComplete: "current-password" })] }), error && (_jsx("p", { className: "rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600", children: error })), _jsx("button", { type: "submit", disabled: loading, className: "btn-primary w-full justify-center", children: loading ? 'Signing in...' : 'Sign in' }), _jsx("button", { type: "button", onClick: showForgotPassword, className: "w-full text-center text-sm font-medium text-slate-500 hover:text-brand", children: "Forgot password?" })] })) : (_jsxs("form", { onSubmit: handlePasswordResetRequest, className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "field-label", children: "Email used as username" }), _jsx("input", { type: "email", value: resetEmail, onChange: e => setResetEmail(e.target.value), className: "input", required: true, autoFocus: true, autoComplete: "email" })] }), error && (_jsx("p", { className: "rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600", children: error })), message && (_jsx("p", { className: "rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700", children: message })), _jsx("button", { type: "submit", disabled: loading, className: "btn-primary w-full justify-center", children: loading ? 'Sending...' : 'Send reset link' }), _jsx("button", { type: "button", onClick: () => {
                                setError('');
                                setMessage('');
                                setMode('login');
                            }, className: "w-full text-center text-sm font-medium text-slate-500 hover:text-brand", children: "Back to sign in" })] }))] }) }));
}

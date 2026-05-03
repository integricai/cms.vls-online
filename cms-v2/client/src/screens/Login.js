import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setCurrentUser, setToken } from '../api/client';
export default function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
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
    return (_jsx("div", { className: "flex min-h-screen items-center justify-center bg-slate-900", children: _jsxs("div", { className: "w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl", children: [_jsx("h1", { className: "mb-1 text-xl font-bold text-slate-900", children: "VLS CMS" }), _jsx("p", { className: "mb-6 text-sm text-slate-500", children: "Sign in to your account" }), _jsxs("form", { onSubmit: handleSubmit, className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "field-label", children: "Username or email" }), _jsx("input", { type: "text", value: username, onChange: e => setUsername(e.target.value), className: "input", required: true, autoFocus: true })] }), _jsxs("div", { children: [_jsx("label", { className: "field-label", children: "Password" }), _jsx("input", { type: "password", value: password, onChange: e => setPassword(e.target.value), className: "input", required: true })] }), error && (_jsx("p", { className: "rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600", children: error })), _jsx("button", { type: "submit", disabled: loading, className: "btn-primary w-full justify-center", children: loading ? 'Signing in…' : 'Sign in' })] })] }) }));
}

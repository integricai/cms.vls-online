import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { api, getCurrentUser } from '../api/client';
const ACCESS_OPTIONS = [
    { value: 'admin', label: 'Admin' },
    { value: 'editor', label: 'Write' },
    { value: 'viewer', label: 'Read' },
];
const EMPTY_FORM = {
    username: '',
    first_name: '',
    last_name: '',
    password_: '',
    access_level: 'viewer',
};
export default function UserManagement() {
    const [users, setUsers] = useState([]);
    const [nameDrafts, setNameDrafts] = useState({});
    const [form, setForm] = useState(EMPTY_FORM);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const currentUser = getCurrentUser();
    async function loadUsers() {
        setLoading(true);
        setError('');
        try {
            const nextUsers = await api.get('/users');
            setUsers(nextUsers);
            setNameDrafts(Object.fromEntries(nextUsers.map(user => [
                user.id,
                { first_name: user.firstName, last_name: user.lastName },
            ])));
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Could not load users');
        }
        finally {
            setLoading(false);
        }
    }
    useEffect(() => {
        loadUsers();
    }, []);
    async function addUser(e) {
        e.preventDefault();
        setSaving(true);
        setError('');
        setMessage('');
        try {
            const user = await api.post('/users', form);
            setUsers(prev => [user, ...prev]);
            setNameDrafts(prev => ({
                ...prev,
                [user.id]: { first_name: user.firstName, last_name: user.lastName },
            }));
            setForm(EMPTY_FORM);
            setMessage('User added');
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Could not add user');
        }
        finally {
            setSaving(false);
        }
    }
    async function updateUser(userId, body) {
        setError('');
        setMessage('');
        try {
            const user = await api.patch(`/users/${userId}`, body);
            setUsers(prev => prev.map(item => item.id === user.id ? user : item));
            setNameDrafts(prev => ({
                ...prev,
                [user.id]: { first_name: user.firstName, last_name: user.lastName },
            }));
            setMessage('User updated');
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Could not update user');
        }
    }
    function updateNameDraft(userId, field, value) {
        setNameDrafts(prev => ({
            ...prev,
            [userId]: {
                first_name: prev[userId]?.first_name ?? '',
                last_name: prev[userId]?.last_name ?? '',
                [field]: value,
            },
        }));
    }
    async function removeUser(user) {
        if (!window.confirm(`Remove ${user.username}?`))
            return;
        setError('');
        setMessage('');
        try {
            await api.delete(`/users/${user.id}`);
            setUsers(prev => prev.filter(item => item.id !== user.id));
            setMessage('User removed');
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Could not remove user');
        }
    }
    return (_jsxs("div", { className: "flex h-full flex-col bg-slate-50", children: [_jsxs("div", { className: "border-b border-slate-200 bg-white px-6 py-5", children: [_jsx("h1", { className: "text-lg font-bold text-slate-900", children: "User Management" }), _jsx("p", { className: "mt-1 text-sm text-slate-500", children: "Add users, block access, remove users, and assign Admin, Write, or Read access." })] }), _jsxs("div", { className: "grid flex-1 grid-cols-[420px_1fr] overflow-hidden", children: [_jsxs("aside", { className: "overflow-y-auto border-r border-slate-200 bg-white px-5 py-5", children: [_jsxs("form", { onSubmit: addUser, className: "space-y-4", autoComplete: "off", children: [_jsx("p", { className: "section-label mt-0", children: "Add User" }), _jsx("input", { type: "text", className: "hidden", autoComplete: "username", tabIndex: -1, "aria-hidden": "true" }), _jsx("input", { type: "password", className: "hidden", autoComplete: "current-password", tabIndex: -1, "aria-hidden": "true" }), _jsxs("div", { children: [_jsx("label", { className: "field-label", children: "Username" }), _jsx("input", { className: "input", value: form.username, autoComplete: "off", inputMode: "email", onChange: e => setForm(prev => ({ ...prev, username: e.target.value })), required: true })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: "field-label", children: "First name" }), _jsx("input", { className: "input", value: form.first_name, autoComplete: "off", onChange: e => setForm(prev => ({ ...prev, first_name: e.target.value })) })] }), _jsxs("div", { children: [_jsx("label", { className: "field-label", children: "Last name" }), _jsx("input", { className: "input", value: form.last_name, autoComplete: "off", onChange: e => setForm(prev => ({ ...prev, last_name: e.target.value })) })] })] }), _jsxs("div", { children: [_jsx("label", { className: "field-label", children: "Password" }), _jsx("input", { type: "password", className: "input", value: form.password_, autoComplete: "new-password", onChange: e => setForm(prev => ({ ...prev, password_: e.target.value })), required: true })] }), _jsxs("div", { children: [_jsx("label", { className: "field-label", children: "Access level" }), _jsx("select", { className: "input", value: form.access_level, onChange: e => setForm(prev => ({ ...prev, access_level: e.target.value })), children: ACCESS_OPTIONS.map(option => _jsx("option", { value: option.value, children: option.label }, option.value)) })] }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { type: "submit", disabled: saving, className: "btn-primary flex-1 justify-center", children: saving ? 'Adding…' : '+ Add User' }), _jsx("button", { type: "button", className: "btn-ghost", onClick: () => setForm(EMPTY_FORM), children: "Clear" })] })] }), (error || message) && (_jsx("div", { className: `mt-4 rounded-lg px-3 py-2 text-sm ${error ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`, children: error || message }))] }), _jsx("main", { className: "overflow-y-auto p-6", children: loading ? (_jsx("div", { className: "text-sm text-slate-400", children: "Loading\u2026" })) : (_jsxs("div", { className: "overflow-hidden rounded-lg border border-slate-200 bg-white", children: [_jsxs("table", { className: "w-full text-left text-sm", children: [_jsx("thead", { className: "border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500", children: _jsxs("tr", { children: [_jsx("th", { className: "px-4 py-3", children: "Username" }), _jsx("th", { className: "px-4 py-3", children: "Name" }), _jsx("th", { className: "px-4 py-3", children: "Access" }), _jsx("th", { className: "px-4 py-3", children: "Status" }), _jsx("th", { className: "px-4 py-3 text-right", children: "Actions" })] }) }), _jsx("tbody", { className: "divide-y divide-slate-100", children: users.map(user => {
                                                const isSelf = currentUser?.id === user.id;
                                                return (_jsxs("tr", { children: [_jsxs("td", { className: "px-4 py-3", children: [_jsx("div", { className: "font-semibold text-slate-900", children: user.username }), _jsx("div", { className: "text-xs text-slate-500", children: user.email })] }), _jsx("td", { className: "px-4 py-3", children: _jsxs("div", { className: "grid grid-cols-[1fr_1fr_auto] gap-2", children: [_jsx("input", { className: "input", placeholder: "First name", value: nameDrafts[user.id]?.first_name ?? user.firstName, onChange: e => updateNameDraft(user.id, 'first_name', e.target.value) }), _jsx("input", { className: "input", placeholder: "Last name", value: nameDrafts[user.id]?.last_name ?? user.lastName, onChange: e => updateNameDraft(user.id, 'last_name', e.target.value) }), _jsx("button", { className: "btn-ghost text-xs", onClick: () => updateUser(user.id, {
                                                                            first_name: nameDrafts[user.id]?.first_name ?? '',
                                                                            last_name: nameDrafts[user.id]?.last_name ?? '',
                                                                        }), children: "Save" })] }) }), _jsx("td", { className: "px-4 py-3", children: _jsx("select", { className: "input w-32", value: user.role, disabled: isSelf, onChange: e => updateUser(user.id, { access_level: e.target.value }), children: ACCESS_OPTIONS.map(option => _jsx("option", { value: option.value, children: option.label }, option.value)) }) }), _jsx("td", { className: "px-4 py-3", children: _jsx("span", { className: `rounded-full px-2 py-1 text-xs font-semibold ${user.isBlocked ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`, children: user.isBlocked ? 'Blocked' : 'Active' }) }), _jsx("td", { className: "px-4 py-3", children: _jsxs("div", { className: "flex justify-end gap-2", children: [_jsx("button", { className: "btn-ghost text-xs", disabled: isSelf, onClick: () => updateUser(user.id, { is_blocked: !user.isBlocked }), children: user.isBlocked ? 'Unblock' : 'Block' }), _jsx("button", { className: "btn-danger text-xs", disabled: isSelf, onClick: () => removeUser(user), children: "Remove" })] }) })] }, user.id));
                                            }) })] }), users.length === 0 && _jsx("div", { className: "px-4 py-8 text-center text-sm text-slate-400", children: "No users yet." })] })) })] })] }));
}

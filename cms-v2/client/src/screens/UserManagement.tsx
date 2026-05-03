import { useEffect, useState } from 'react';
import { api, getCurrentUser, type AccessLevel, type CurrentUser } from '../api/client';

type FormState = {
  username: string;
  first_name: string;
  last_name: string;
  password_: string;
  access_level: AccessLevel;
};

const ACCESS_OPTIONS: Array<{ value: AccessLevel; label: string }> = [
  { value: 'admin', label: 'Admin' },
  { value: 'editor', label: 'Write' },
  { value: 'viewer', label: 'Read' },
];

const EMPTY_FORM: FormState = {
  username: '',
  first_name: '',
  last_name: '',
  password_: '',
  access_level: 'viewer',
};

export default function UserManagement() {
  const [users, setUsers] = useState<CurrentUser[]>([]);
  const [nameDrafts, setNameDrafts] = useState<Record<number, { first_name: string; last_name: string }>>({});
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const currentUser = getCurrentUser();

  async function loadUsers() {
    setLoading(true);
    setError('');
    try {
      const nextUsers = await api.get<CurrentUser[]>('/users');
      setUsers(nextUsers);
      setNameDrafts(Object.fromEntries(nextUsers.map(user => [
        user.id,
        { first_name: user.firstName, last_name: user.lastName },
      ])));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load users');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function addUser(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const user = await api.post<CurrentUser>('/users', form);
      setUsers(prev => [user, ...prev]);
      setNameDrafts(prev => ({
        ...prev,
        [user.id]: { first_name: user.firstName, last_name: user.lastName },
      }));
      setForm(EMPTY_FORM);
      setMessage('User added');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add user');
    } finally {
      setSaving(false);
    }
  }

  async function updateUser(userId: number, body: Record<string, unknown>) {
    setError('');
    setMessage('');
    try {
      const user = await api.patch<CurrentUser>(`/users/${userId}`, body);
      setUsers(prev => prev.map(item => item.id === user.id ? user : item));
      setNameDrafts(prev => ({
        ...prev,
        [user.id]: { first_name: user.firstName, last_name: user.lastName },
      }));
      setMessage('User updated');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update user');
    }
  }

  function updateNameDraft(userId: number, field: 'first_name' | 'last_name', value: string) {
    setNameDrafts(prev => ({
      ...prev,
      [userId]: {
        first_name: prev[userId]?.first_name ?? '',
        last_name: prev[userId]?.last_name ?? '',
        [field]: value,
      },
    }));
  }

  async function removeUser(user: CurrentUser) {
    if (!window.confirm(`Remove ${user.username}?`)) return;
    setError('');
    setMessage('');
    try {
      await api.delete<{ id: number }>(`/users/${user.id}`);
      setUsers(prev => prev.filter(item => item.id !== user.id));
      setMessage('User removed');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove user');
    }
  }

  return (
    <div className="flex h-full flex-col bg-slate-50">
      <div className="border-b border-slate-200 bg-white px-6 py-5">
        <h1 className="text-lg font-bold text-slate-900">User Management</h1>
        <p className="mt-1 text-sm text-slate-500">Add users, block access, remove users, and assign Admin, Write, or Read access.</p>
      </div>

      <div className="grid flex-1 grid-cols-[420px_1fr] overflow-hidden">
        <aside className="overflow-y-auto border-r border-slate-200 bg-white px-5 py-5">
          <form onSubmit={addUser} className="space-y-4" autoComplete="off">
            <p className="section-label mt-0">Add User</p>
            <input type="text" className="hidden" autoComplete="username" tabIndex={-1} aria-hidden="true" />
            <input type="password" className="hidden" autoComplete="current-password" tabIndex={-1} aria-hidden="true" />
            <div>
              <label className="field-label">Username</label>
              <input
                className="input"
                value={form.username}
                autoComplete="off"
                inputMode="email"
                onChange={e => setForm(prev => ({ ...prev, username: e.target.value }))}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="field-label">First name</label>
                <input className="input" value={form.first_name} autoComplete="off" onChange={e => setForm(prev => ({ ...prev, first_name: e.target.value }))} />
              </div>
              <div>
                <label className="field-label">Last name</label>
                <input className="input" value={form.last_name} autoComplete="off" onChange={e => setForm(prev => ({ ...prev, last_name: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="field-label">Password</label>
              <input
                type="password"
                className="input"
                value={form.password_}
                autoComplete="new-password"
                onChange={e => setForm(prev => ({ ...prev, password_: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="field-label">Access level</label>
              <select className="input" value={form.access_level} onChange={e => setForm(prev => ({ ...prev, access_level: e.target.value as AccessLevel }))}>
                {ACCESS_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
                {saving ? 'Adding…' : '+ Add User'}
              </button>
              <button type="button" className="btn-ghost" onClick={() => setForm(EMPTY_FORM)}>
                Clear
              </button>
            </div>
          </form>

          {(error || message) && (
            <div className={`mt-4 rounded-lg px-3 py-2 text-sm ${error ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>
              {error || message}
            </div>
          )}
        </aside>

        <main className="overflow-y-auto p-6">
          {loading ? (
            <div className="text-sm text-slate-400">Loading…</div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Username</th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Access</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map(user => {
                    const isSelf = currentUser?.id === user.id;
                    return (
                      <tr key={user.id}>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900">{user.username}</div>
                          <div className="text-xs text-slate-500">{user.email}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
                            <input
                              className="input"
                              placeholder="First name"
                              value={nameDrafts[user.id]?.first_name ?? user.firstName}
                              onChange={e => updateNameDraft(user.id, 'first_name', e.target.value)}
                            />
                            <input
                              className="input"
                              placeholder="Last name"
                              value={nameDrafts[user.id]?.last_name ?? user.lastName}
                              onChange={e => updateNameDraft(user.id, 'last_name', e.target.value)}
                            />
                            <button
                              className="btn-ghost text-xs"
                              onClick={() => updateUser(user.id, {
                                first_name: nameDrafts[user.id]?.first_name ?? '',
                                last_name: nameDrafts[user.id]?.last_name ?? '',
                              })}
                            >
                              Save
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <select
                            className="input w-32"
                            value={user.role}
                            disabled={isSelf}
                            onChange={e => updateUser(user.id, { access_level: e.target.value })}
                          >
                            {ACCESS_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-1 text-xs font-semibold ${user.isBlocked ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>
                            {user.isBlocked ? 'Blocked' : 'Active'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <button
                              className="btn-ghost text-xs"
                              disabled={isSelf}
                              onClick={() => updateUser(user.id, { is_blocked: !user.isBlocked })}
                            >
                              {user.isBlocked ? 'Unblock' : 'Block'}
                            </button>
                            <button className="btn-danger text-xs" disabled={isSelf} onClick={() => removeUser(user)}>
                              Remove
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {users.length === 0 && <div className="px-4 py-8 text-center text-sm text-slate-400">No users yet.</div>}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

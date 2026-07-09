import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api/client';
import type { Course, Tutor } from '../../../../shared/types';

type TutorDraft = {
  id?: number;
  name: string;
  email: string;
  role: string;
  bio: string;
  photoUrl: string;
  initials: string;
  isActive: boolean;
  courseIds: number[];
};

function emptyDraft(): TutorDraft {
  return {
    name: '',
    email: '',
    role: '',
    bio: '',
    photoUrl: '',
    initials: '',
    isActive: true,
    courseIds: [],
  };
}

function tutorToDraft(tutor: Tutor): TutorDraft {
  return {
    id: tutor.id,
    name: tutor.name,
    email: tutor.email ?? '',
    role: tutor.role ?? '',
    bio: tutor.bio ?? '',
    photoUrl: tutor.photoUrl ?? '',
    initials: tutor.initials ?? '',
    isActive: tutor.isActive,
    courseIds: tutor.courseIds ?? [],
  };
}

export default function TutorsTab() {
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [draft, setDraft] = useState<TutorDraft>(emptyDraft());
  const [editingId, setEditingId] = useState<number | null>(null);

  const activeCourses = useMemo(
    () => courses.filter(course => course.isActive).sort((a, b) => a.name.localeCompare(b.name)),
    [courses],
  );

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [tutorData, courseData] = await Promise.all([
        api.get<Tutor[]>('/tutors'),
        api.get<Course[]>('/courses'),
      ]);
      setTutors(tutorData ?? []);
      setCourses(courseData ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tutors');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  function toggleCourse(courseId: number) {
    setDraft(prev => ({
      ...prev,
      courseIds: prev.courseIds.includes(courseId)
        ? prev.courseIds.filter(id => id !== courseId)
        : [...prev.courseIds, courseId],
    }));
  }

  async function saveTutor() {
    if (!draft.name.trim()) {
      setError('Tutor name is required');
      return;
    }
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const body = {
        name: draft.name.trim(),
        email: draft.email.trim() || null,
        role: draft.role.trim() || null,
        bio: draft.bio.trim() || null,
        photoUrl: draft.photoUrl.trim() || null,
        initials: draft.initials.trim() || null,
        isActive: draft.isActive,
        courseIds: draft.courseIds,
      };
      if (editingId) {
        await api.put(`/tutors/${editingId}`, body);
        setMessage('Tutor updated');
      } else {
        await api.post('/tutors', body);
        setMessage('Tutor created');
      }
      setDraft(emptyDraft());
      setEditingId(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save tutor');
    } finally {
      setSaving(false);
    }
  }

  async function deactivateTutor(id: number) {
    if (!confirm('Deactivate this tutor?')) return;
    setError('');
    try {
      await api.post(`/tutors/${id}/deactivate`, {});
      setMessage('Tutor deactivated');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to deactivate tutor');
    }
  }

  return (
    <div className="p-6">
      <div className="mb-4">
        <h2 className="mb-1 text-sm font-bold text-slate-700">Tutors</h2>
        <p className="text-xs text-slate-500">
          Create tutors and assign the courses they teach.
        </p>
      </div>

      {error && <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {message && <div className="mb-4 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</div>}

      <div className="mb-6 rounded-lg border border-slate-200 bg-white p-4">
        <p className="section-label">{editingId ? 'Edit tutor' : 'Add tutor'}</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-xs text-slate-600">
            Name
            <input className="input mt-1" value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} />
          </label>
          <label className="text-xs text-slate-600">
            Email
            <input className="input mt-1" type="email" value={draft.email} onChange={e => setDraft(d => ({ ...d, email: e.target.value }))} />
          </label>
          <label className="text-xs text-slate-600">
            Role / designation
            <input className="input mt-1" value={draft.role} onChange={e => setDraft(d => ({ ...d, role: e.target.value }))} />
          </label>
          <label className="text-xs text-slate-600">
            Initials
            <input className="input mt-1" value={draft.initials} maxLength={4} onChange={e => setDraft(d => ({ ...d, initials: e.target.value }))} />
          </label>
          <label className="text-xs text-slate-600">
            Photo URL
            <input className="input mt-1" value={draft.photoUrl} onChange={e => setDraft(d => ({ ...d, photoUrl: e.target.value }))} />
          </label>
          <label className="flex items-end gap-2 pb-2 text-xs text-slate-700">
            <input type="checkbox" checked={draft.isActive} onChange={e => setDraft(d => ({ ...d, isActive: e.target.checked }))} />
            Active
          </label>
          <label className="text-xs text-slate-600 sm:col-span-2 lg:col-span-3">
            Bio
            <textarea className="input mt-1 min-h-[80px]" value={draft.bio} onChange={e => setDraft(d => ({ ...d, bio: e.target.value }))} />
          </label>
        </div>

        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Assigned courses</p>
          {activeCourses.length === 0 ? (
            <p className="text-xs text-slate-400">No active courses found. Sync courses first.</p>
          ) : (
            <div className="grid max-h-48 gap-2 overflow-auto sm:grid-cols-2 lg:grid-cols-3">
              {activeCourses.map(course => (
                <label key={course.id} className="flex items-start gap-2 rounded border border-slate-200 px-3 py-2 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={draft.courseIds.includes(course.id)}
                    onChange={() => toggleCourse(course.id)}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="font-medium">{course.name}</span>
                    {course.slug && <span className="block text-[11px] text-slate-400">{course.slug}</span>}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 flex gap-2">
          <button className="btn-primary text-xs" disabled={saving} onClick={() => void saveTutor()}>
            {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add tutor'}
          </button>
          {editingId && (
            <button className="btn-ghost text-xs" onClick={() => { setEditingId(null); setDraft(emptyDraft()); }}>
              Cancel edit
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[760px] text-left text-xs">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Courses</th>
              <th className="px-3 py-2">Active</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-500">Loading…</td></tr>
            )}
            {!loading && tutors.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-500">No tutors yet.</td></tr>
            )}
            {!loading && tutors.map(tutor => (
              <tr key={tutor.id} className="border-t border-slate-100">
                <td className="px-3 py-2">
                  <div className="font-medium text-slate-800">{tutor.name}</div>
                  {tutor.initials && <div className="text-[11px] text-slate-400">{tutor.initials}</div>}
                </td>
                <td className="px-3 py-2">{tutor.role || '—'}</td>
                <td className="px-3 py-2">{tutor.email || '—'}</td>
                <td className="px-3 py-2">
                  {(tutor.courseNames?.length ?? tutor.courseIds.length) > 0
                    ? (tutor.courseNames ?? tutor.courseIds.map(String)).join(', ')
                    : '—'}
                </td>
                <td className="px-3 py-2">{tutor.isActive ? 'Yes' : 'No'}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    <button className="btn-ghost text-[11px]" onClick={() => { setEditingId(tutor.id); setDraft(tutorToDraft(tutor)); }}>
                      Edit
                    </button>
                    {tutor.isActive && (
                      <button className="btn-ghost text-[11px]" onClick={() => void deactivateTutor(tutor.id)}>
                        Deactivate
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

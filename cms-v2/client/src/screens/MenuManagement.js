import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useSidebarConfig } from '../contexts/sidebarConfig';
import { buildDefaultConfig, buildItemLookup, } from '../nav';
const ITEM_LOOKUP = buildItemLookup();
const CONTENT_KEY = 'vls-sidebar-config';
function getLabel(id) {
    return ITEM_LOOKUP.get(id) ?? id;
}
// Count all visible leaf items under a group (used for the auto-hide badge)
function countVisibleLeaves(group) {
    let count = 0;
    for (const child of group.children) {
        if (child.hidden)
            continue;
        if (child.type === 'item') {
            count++;
        }
        else {
            count += child.children.filter(i => !i.hidden).length;
        }
    }
    return count;
}
// ── Pure config mutation helpers ─────────────────────────────────────────────
function setGroupHidden(cfg, groupId, hidden) {
    return cfg.map(g => (g.id === groupId ? { ...g, hidden } : g));
}
function moveGroup(cfg, groupId, dir) {
    const idx = cfg.findIndex(g => g.id === groupId);
    if (idx < 0)
        return cfg;
    const swap = idx + dir;
    if (swap < 0 || swap >= cfg.length)
        return cfg;
    const next = [...cfg];
    [next[idx], next[swap]] = [next[swap], next[idx]];
    return next;
}
function setChildHidden(cfg, groupId, childId, hidden) {
    return cfg.map(g => {
        if (g.id !== groupId)
            return g;
        return {
            ...g,
            children: g.children.map(c => (c.id === childId ? { ...c, hidden } : c)),
        };
    });
}
function moveChild(cfg, groupId, childId, dir) {
    return cfg.map(g => {
        if (g.id !== groupId)
            return g;
        const idx = g.children.findIndex(c => c.id === childId);
        if (idx < 0)
            return g;
        const swap = idx + dir;
        if (swap < 0 || swap >= g.children.length)
            return g;
        const next = [...g.children];
        [next[idx], next[swap]] = [next[swap], next[idx]];
        return { ...g, children: next };
    });
}
function moveChildToGroup(cfg, fromGroupId, childId, toGroupId) {
    let moved = null;
    const without = cfg.map(g => {
        if (g.id !== fromGroupId)
            return g;
        const child = g.children.find(c => c.id === childId);
        if (child)
            moved = child;
        return { ...g, children: g.children.filter(c => c.id !== childId) };
    });
    if (!moved)
        return cfg;
    return without.map(g => {
        if (g.id !== toGroupId)
            return g;
        return { ...g, children: [...g.children, moved] };
    });
}
function setSubItemHidden(cfg, groupId, subId, itemId, hidden) {
    return cfg.map(g => {
        if (g.id !== groupId)
            return g;
        return {
            ...g,
            children: g.children.map(c => {
                if (c.id !== subId || c.type !== 'subgroup')
                    return c;
                return {
                    ...c,
                    children: c.children.map(i => (i.id === itemId ? { ...i, hidden } : i)),
                };
            }),
        };
    });
}
function moveSubItem(cfg, groupId, subId, itemId, dir) {
    return cfg.map(g => {
        if (g.id !== groupId)
            return g;
        return {
            ...g,
            children: g.children.map(c => {
                if (c.id !== subId || c.type !== 'subgroup')
                    return c;
                const idx = c.children.findIndex(i => i.id === itemId);
                if (idx < 0)
                    return c;
                const swap = idx + dir;
                if (swap < 0 || swap >= c.children.length)
                    return c;
                const next = [...c.children];
                [next[idx], next[swap]] = [next[swap], next[idx]];
                return { ...c, children: next };
            }),
        };
    });
}
// Moves a sub-item out of its subgroup into the top-level children of another group
function moveSubItemToGroup(cfg, fromGroupId, subId, itemId, toGroupId) {
    let moved = null;
    const without = cfg.map(g => {
        if (g.id !== fromGroupId)
            return g;
        return {
            ...g,
            children: g.children.map(c => {
                if (c.id !== subId || c.type !== 'subgroup')
                    return c;
                const item = c.children.find(i => i.id === itemId);
                if (item)
                    moved = item;
                return { ...c, children: c.children.filter(i => i.id !== itemId) };
            }),
        };
    });
    if (!moved)
        return cfg;
    return without.map(g => {
        if (g.id !== toGroupId)
            return g;
        return { ...g, children: [...g.children, moved] };
    });
}
// ── Row components ────────────────────────────────────────────────────────────
function ArrowBtn({ dir, disabled, onClick, }) {
    return (_jsx("button", { onClick: onClick, disabled: disabled, title: dir === 'up' ? 'Move up' : 'Move down', className: "flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:pointer-events-none disabled:opacity-25 text-[10px]", children: dir === 'up' ? '▲' : '▼' }));
}
function VisibleToggle({ checked, onChange, }) {
    return (_jsxs("label", { className: "flex cursor-pointer items-center gap-1.5 select-none", children: [_jsx("input", { type: "checkbox", checked: checked, onChange: e => onChange(e.target.checked), className: "h-3.5 w-3.5 rounded border-slate-300 accent-[#204280]" }), _jsx("span", { className: "text-xs text-slate-400", children: "Show" })] }));
}
function MoveSelect({ label, groupIds, currentGroupId, onChange, }) {
    return (_jsxs("select", { value: "", onChange: e => { if (e.target.value)
            onChange(e.target.value); }, className: "rounded border border-slate-200 bg-white px-1.5 py-0.5 text-xs text-slate-600", children: [_jsx("option", { value: "", children: label }), groupIds
                .filter(id => id !== currentGroupId)
                .map(id => (_jsx("option", { value: id, children: id }, id)))] }));
}
// ── Main screen ───────────────────────────────────────────────────────────────
export default function MenuManagement() {
    const { config: savedConfig, reload } = useSidebarConfig();
    const [draft, setDraft] = useState(savedConfig);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [expanded, setExpanded] = useState(new Set());
    // Sync draft when saved config loads from API
    useEffect(() => {
        setDraft(savedConfig);
        setExpanded(new Set(savedConfig.map(g => g.id)));
    }, [savedConfig]);
    async function save() {
        setSaving(true);
        setMessage('');
        setError('');
        try {
            await api.put(`/content/${CONTENT_KEY}`, draft);
            await reload();
            setMessage('Menu configuration saved.');
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Could not save');
        }
        finally {
            setSaving(false);
        }
    }
    function resetToDefaults() {
        if (!window.confirm('Reset menu to original defaults? This will undo all changes.'))
            return;
        setDraft(buildDefaultConfig());
        setMessage('');
        setError('');
    }
    function toggleExpand(groupId) {
        setExpanded(prev => {
            const next = new Set(prev);
            next.has(groupId) ? next.delete(groupId) : next.add(groupId);
            return next;
        });
    }
    const groupIds = draft.map(g => g.id);
    return (_jsxs("div", { className: "flex h-full flex-col bg-slate-50", children: [_jsxs("div", { className: "flex items-start justify-between border-b border-slate-200 bg-white px-6 py-5", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-lg font-bold text-slate-900", children: "Menu Settings" }), _jsx("p", { className: "mt-1 text-sm text-slate-500", children: "Show or hide sidebar items, reorder groups, and move items between groups. Groups with only 1 visible item automatically hide their header." })] }), _jsxs("div", { className: "flex shrink-0 gap-2 ml-6", children: [_jsx("button", { className: "btn-ghost", onClick: resetToDefaults, children: "Reset defaults" }), _jsx("button", { className: "btn-primary", onClick: save, disabled: saving, children: saving ? 'Saving…' : 'Save Changes' })] })] }), (message || error) && (_jsx("div", { className: `mx-6 mt-4 rounded-lg px-4 py-2 text-sm ${error ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`, children: message || error })), _jsx("div", { className: "flex-1 overflow-y-auto p-6 space-y-3", children: draft.map((group, gIdx) => {
                    const visibleLeaves = countVisibleLeaves(group);
                    const autoHideHeader = !group.hidden && visibleLeaves === 1;
                    const isExpanded = expanded.has(group.id);
                    return (_jsxs("div", { className: "overflow-hidden rounded-lg border border-slate-200 bg-white", children: [_jsxs("div", { className: `flex items-center gap-3 px-4 py-3 ${isExpanded ? 'border-b border-slate-100' : ''}`, children: [_jsxs("button", { onClick: () => toggleExpand(group.id), className: "flex flex-1 items-center gap-2 text-left min-w-0", children: [_jsx("svg", { viewBox: "0 0 20 20", fill: "currentColor", className: `h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-150 ${isExpanded ? 'rotate-90' : ''}`, children: _jsx("path", { fillRule: "evenodd", d: "M7.293 4.293a1 1 0 011.414 0l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414-1.414L11.586 10 7.293 5.707a1 1 0 010-1.414z", clipRule: "evenodd" }) }), _jsx("span", { className: `truncate text-sm font-semibold ${group.hidden ? 'text-slate-400 line-through' : 'text-slate-900'}`, children: group.id }), autoHideHeader && (_jsx("span", { className: "shrink-0 rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-600", children: "1 visible \u2014 header auto-hidden" })), !group.hidden && visibleLeaves === 0 && (_jsx("span", { className: "shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500", children: "no visible items" }))] }), _jsxs("div", { className: "flex shrink-0 items-center gap-2", children: [_jsx(VisibleToggle, { checked: !group.hidden, onChange: v => setDraft(d => setGroupHidden(d, group.id, !v)) }), _jsxs("div", { className: "flex gap-0.5", children: [_jsx(ArrowBtn, { dir: "up", disabled: gIdx === 0, onClick: () => setDraft(d => moveGroup(d, group.id, -1)) }), _jsx(ArrowBtn, { dir: "down", disabled: gIdx === draft.length - 1, onClick: () => setDraft(d => moveGroup(d, group.id, 1)) })] })] })] }), isExpanded && (_jsxs("div", { children: [group.children.length === 0 && (_jsx("p", { className: "px-6 py-4 text-sm text-slate-400", children: "No items in this group." })), group.children.map((child, cIdx) => {
                                        if (child.type === 'item') {
                                            return (_jsxs("div", { className: "flex items-center gap-3 border-b border-slate-50 px-6 py-2 last:border-0", children: [_jsx("span", { className: `flex-1 truncate text-sm ${child.hidden ? 'text-slate-400 line-through' : 'text-slate-700'}`, children: getLabel(child.id) }), _jsx(VisibleToggle, { checked: !child.hidden, onChange: v => setDraft(d => setChildHidden(d, group.id, child.id, !v)) }), _jsxs("div", { className: "flex gap-0.5", children: [_jsx(ArrowBtn, { dir: "up", disabled: cIdx === 0, onClick: () => setDraft(d => moveChild(d, group.id, child.id, -1)) }), _jsx(ArrowBtn, { dir: "down", disabled: cIdx === group.children.length - 1, onClick: () => setDraft(d => moveChild(d, group.id, child.id, 1)) })] }), _jsx(MoveSelect, { label: "Move to\u2026", groupIds: groupIds, currentGroupId: group.id, onChange: toId => setDraft(d => moveChildToGroup(d, group.id, child.id, toId)) })] }, child.id));
                                        }
                                        // SubGroup
                                        const sub = child;
                                        return (_jsxs("div", { className: "border-b border-slate-50 last:border-0", children: [_jsxs("div", { className: "flex items-center gap-3 bg-slate-50 px-6 py-2", children: [_jsx("span", { className: `flex-1 text-xs font-semibold uppercase tracking-wider ${sub.hidden ? 'text-slate-300 line-through' : 'text-slate-500'}`, children: sub.id }), _jsx(VisibleToggle, { checked: !sub.hidden, onChange: v => setDraft(d => setChildHidden(d, group.id, sub.id, !v)) }), _jsxs("div", { className: "flex gap-0.5", children: [_jsx(ArrowBtn, { dir: "up", disabled: cIdx === 0, onClick: () => setDraft(d => moveChild(d, group.id, sub.id, -1)) }), _jsx(ArrowBtn, { dir: "down", disabled: cIdx === group.children.length - 1, onClick: () => setDraft(d => moveChild(d, group.id, sub.id, 1)) })] }), _jsx(MoveSelect, { label: "Move subgroup to\u2026", groupIds: groupIds, currentGroupId: group.id, onChange: toId => setDraft(d => moveChildToGroup(d, group.id, sub.id, toId)) })] }), sub.children.map((item, iIdx) => (_jsxs("div", { className: "flex items-center gap-3 border-t border-slate-50 px-10 py-2", children: [_jsx("span", { className: `flex-1 truncate text-sm ${item.hidden ? 'text-slate-400 line-through' : 'text-slate-700'}`, children: getLabel(item.id) }), _jsx(VisibleToggle, { checked: !item.hidden, onChange: v => setDraft(d => setSubItemHidden(d, group.id, sub.id, item.id, !v)) }), _jsxs("div", { className: "flex gap-0.5", children: [_jsx(ArrowBtn, { dir: "up", disabled: iIdx === 0, onClick: () => setDraft(d => moveSubItem(d, group.id, sub.id, item.id, -1)) }), _jsx(ArrowBtn, { dir: "down", disabled: iIdx === sub.children.length - 1, onClick: () => setDraft(d => moveSubItem(d, group.id, sub.id, item.id, 1)) })] }), _jsx(MoveSelect, { label: "Move to\u2026", groupIds: groupIds, currentGroupId: group.id, onChange: toId => setDraft(d => moveSubItemToGroup(d, group.id, sub.id, item.id, toId)) })] }, item.id)))] }, sub.id));
                                    })] }))] }, group.id));
                }) })] }));
}

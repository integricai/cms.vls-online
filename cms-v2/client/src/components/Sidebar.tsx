import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { clearToken, getCurrentUser } from '../api/client';
import { useSidebarConfig } from '../contexts/sidebarConfig';
import {
  buildItemLookup,
  type SidebarConfigGroup,
  type SidebarConfigItem,
  type SidebarConfigSubGroup,
} from '../nav';

const ITEM_LOOKUP = buildItemLookup();

function getLabel(id: string): string {
  if (id === '/dashboard') return 'Dashboard';
  return ITEM_LOOKUP.get(id) ?? id;
}

function visibleTopLevel(
  group: SidebarConfigGroup,
): Array<SidebarConfigItem | SidebarConfigSubGroup> {
  return group.children.filter(child => {
    if (child.hidden) return false;
    if (child.type === 'item' && child.id === '/dashboard') return false;
    if (child.type === 'subgroup') return child.children.some(i => !i.hidden);
    return true;
  });
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: Props) {
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [openSubGroups, setOpenSubGroups] = useState<Set<string>>(new Set());
  const { config } = useSidebarConfig();
  const location = useLocation();
  const currentUser = getCurrentUser();
  const isAdmin = currentUser?.role === 'admin';

  useEffect(() => {
    for (const group of config) {
      for (const child of group.children) {
        if (child.type === 'item' && child.id === location.pathname) {
          setOpenGroup(group.id);
          return;
        }
        if (child.type === 'subgroup' && child.children.some(item => item.id === location.pathname)) {
          setOpenGroup(group.id);
          setOpenSubGroups(prev => new Set(prev).add(child.id));
          return;
        }
      }
    }
  }, [config, location.pathname]);

  function toggleGroup(name: string) {
    setOpenGroup(prev => (prev === name ? null : name));
  }

  function toggleSubGroup(id: string) {
    setOpenSubGroups(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function renderNavItem(item: SidebarConfigItem) {
    return (
      <NavLink
        key={item.id}
        to={item.id}
        className={({ isActive }) =>
          `flex items-center rounded-lg px-3 py-2 text-sm font-medium transition ${
            isActive
              ? 'bg-brand text-white'
              : 'text-slate-400 hover:bg-slate-800 hover:text-white'
          }`
        }
      >
        {getLabel(item.id)}
      </NavLink>
    );
  }

  function renderSubGroup(sub: SidebarConfigSubGroup) {
    const visibleItems = sub.children.filter(i => !i.hidden);
    if (visibleItems.length === 0) return null;
    const expanded = openSubGroups.has(sub.id);
    return (
      <div key={sub.id}>
        <button
          onClick={() => toggleSubGroup(sub.id)}
          className="flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left transition hover:bg-slate-800"
        >
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            {sub.id}
          </span>
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            className={`h-3 w-3 text-slate-500 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
          >
            <path
              fillRule="evenodd"
              d="M7.293 4.293a1 1 0 011.414 0l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414-1.414L11.586 10 7.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
        <div
          className={`overflow-hidden transition-[max-height] duration-200 ease-in-out ${expanded ? 'max-h-[600px]' : 'max-h-0'}`}
        >
          <div className="ml-3 mb-1 space-y-0.5 border-l border-slate-700 pl-2">
            {visibleItems.map(item => renderNavItem(item))}
          </div>
        </div>
      </div>
    );
  }

  function renderGroupChildren(
    children: Array<SidebarConfigItem | SidebarConfigSubGroup>,
  ) {
    return children.map(child => {
      if (child.type === 'subgroup') return renderSubGroup(child);
      return renderNavItem(child);
    });
  }

  return (
    <aside
      className={`flex flex-col bg-slate-900 text-slate-300 transition-[width] duration-300 ease-in-out overflow-hidden shrink-0 ${
        isOpen ? 'w-56' : 'w-0'
      }`}
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between border-b border-slate-700 px-4 py-4 min-w-[224px]">
        <span className="text-sm font-bold text-white tracking-wide">VLS CMS</span>
        <button
          onClick={onClose}
          title="Collapse sidebar"
          className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-700 hover:text-white"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path
              fillRule="evenodd"
              d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>

      {/* ── Navigation tree ── */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 min-w-[224px]">
        {config
          .filter(g => !g.hidden)
          .map(group => {
            const visible = visibleTopLevel(group);
            if (visible.length === 0) return null;

            // Auto-hide group header when only 1 visible child
            if (visible.length === 1) {
              const single = visible[0];
              if (single.type === 'item') return renderNavItem(single);
              return renderSubGroup(single);
            }

            const expanded = openGroup === group.id;
            return (
              <div key={group.id}>
                <button
                  onClick={() => toggleGroup(group.id)}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition hover:bg-slate-800"
                >
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                    {group.id}
                  </span>
                  <svg
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className={`h-3.5 w-3.5 text-slate-500 transition-transform duration-200 ${
                      expanded ? 'rotate-90' : ''
                    }`}
                  >
                    <path
                      fillRule="evenodd"
                      d="M7.293 4.293a1 1 0 011.414 0l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414-1.414L11.586 10 7.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>

                <div
                  className={`overflow-hidden transition-[max-height] duration-200 ease-in-out ${
                    expanded ? 'max-h-[600px]' : 'max-h-0'
                  }`}
                >
                  <div className="ml-3 mt-0.5 mb-1 space-y-0.5 border-l border-slate-700 pl-2">
                    {renderGroupChildren(visible)}
                  </div>
                </div>
              </div>
            );
          })}
      </nav>

      {/* ── Footer ── */}
      <div className="border-t border-slate-700 px-2 py-3 min-w-[224px]">
        <NavLink
          to="/dashboard"
          title="Dashboard"
          className={({ isActive }) =>
            `mb-1 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
              isActive
                ? 'bg-brand text-white'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`
          }
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path d="M3 4a1 1 0 011-1h5a1 1 0 011 1v5a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM11 4a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1V4zM11 10a1 1 0 011-1h4a1 1 0 011 1v6a1 1 0 01-1 1h-4a1 1 0 01-1-1v-6zM3 12a1 1 0 011-1h5a1 1 0 011 1v4a1 1 0 01-1 1H4a1 1 0 01-1-1v-4z" />
          </svg>
          Dashboard
        </NavLink>
        {isAdmin && (
          <NavLink
            to="/settings"
            title="Admin Settings"
            className={({ isActive }) =>
              `mb-1 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                isActive
                  ? 'bg-brand text-white'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`
            }
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path
                fillRule="evenodd"
                d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.53 1.53 0 01-2.29.95c-1.37-.83-2.94.74-2.11 2.11.47.78.05 1.8-.95 2.04-1.56.38-1.56 2.6 0 2.98 1 .24 1.42 1.26.95 2.04-.83 1.37.74 2.94 2.11 2.11.78-.47 1.8-.05 2.04.95.38 1.56 2.6 1.56 2.98 0 .24-1 1.26-1.42 2.04-.95 1.37.83 2.94-.74 2.11-2.11-.47-.78-.05-1.8.95-2.04 1.56-.38 1.56-2.6 0-2.98-1-.24-1.42-1.26-.95-2.04.83-1.37-.74-2.94-2.11-2.11-.78.47-1.8.05-2.04-.95zM10 13a3 3 0 100-6 3 3 0 000 6z"
                clipRule="evenodd"
              />
            </svg>
            Settings
          </NavLink>
        )}
        <button
          onClick={() => {
            clearToken();
            window.location.href = '/login';
          }}
          className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-400 transition hover:bg-slate-800 hover:text-white"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}

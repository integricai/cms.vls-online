import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { clearToken } from '../api/client';

type NavItem  = { to: string; label: string };
type NavGroup = { group: string; children: NavItem[] };
type NavEntry = NavGroup | NavItem;

const NAV: NavEntry[] = [
  {
    group: 'Global',
    children: [
      { to: '/header',           label: 'Header' },
      { to: '/footer',           label: 'Footer' },
      { to: '/banner',           label: 'Banner' },
      { to: '/promotion-section', label: 'Promotion Section' },
      { to: '/contact-footer',   label: 'Contact Footer' },
    ],
  },
  {
    group: 'Home Page',
    children: [
      { to: '/home-hero', label: 'Hero — Left Pane' },
      { to: '/about-us',  label: 'About Us' },
    ],
  },
  {
    group: 'Course Page',
    children: [
      { to: '/course-hero',       label: 'Left Hero Section' },
      { to: '/course-hero-right', label: 'Right Hero Section' },
      { to: '/course-desc',       label: 'Course Description' },
      { to: '/course-tabs',       label: 'Course Tabs' },
      { to: '/hero-section-v2',  label: 'Hero Section V2' },
    ],
  },
  {
    group: 'Cards',
    children: [
      { to: '/program-cards',    label: 'Program Cards' },
      { to: '/program-cards-v2', label: 'Program Cards v2' },
      { to: '/feature-cards',    label: 'Feature Cards' },
      { to: '/feature-cards-v2', label: 'Feature Card v2' },
      { to: '/feature-cards-v3', label: 'Feature Card v3' },
    ],
  },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: Props) {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ 'Global': true, 'Home Page': true, 'Course Page': true, 'Cards': true });

  function toggleGroup(name: string) {
    setOpenGroups(prev => ({ ...prev, [name]: !prev[name] }));
  }

  return (
    <aside
      className={`flex flex-col bg-slate-900 text-slate-300 transition-[width] duration-300 ease-in-out overflow-hidden shrink-0 ${
        isOpen ? 'w-56' : 'w-0'
      }`}
    >
      {/* ── Header with close button ── */}
      <div className="flex items-center justify-between border-b border-slate-700 px-4 py-4 min-w-[224px]">
        <span className="text-sm font-bold text-white tracking-wide">VLS CMS</span>
        <button
          onClick={onClose}
          title="Collapse sidebar"
          className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-700 hover:text-white"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      {/* ── Navigation tree ── */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 min-w-[224px]">
        {NAV.map((entry, i) => {
          if ('group' in entry) {
            const expanded = openGroups[entry.group] ?? true;
            return (
              <div key={i}>
                <button
                  onClick={() => toggleGroup(entry.group)}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition hover:bg-slate-800"
                >
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                    {entry.group}
                  </span>
                  <svg
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className={`h-3.5 w-3.5 text-slate-500 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
                  >
                    <path fillRule="evenodd" d="M7.293 4.293a1 1 0 011.414 0l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414-1.414L11.586 10 7.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>

                <div
                  className={`overflow-hidden transition-[max-height] duration-200 ease-in-out ${
                    expanded ? 'max-h-96' : 'max-h-0'
                  }`}
                >
                  <div className="ml-3 mt-0.5 mb-1 space-y-0.5 border-l border-slate-700 pl-2">
                    {entry.children.map(item => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        className={({ isActive }) =>
                          `flex items-center rounded-lg px-3 py-2 text-sm font-medium transition ${
                            isActive
                              ? 'bg-brand text-white'
                              : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                          }`
                        }
                      >
                        {item.label}
                      </NavLink>
                    ))}
                  </div>
                </div>
              </div>
            );
          }

          return (
            <NavLink
              key={entry.to}
              to={entry.to}
              className={({ isActive }) =>
                `flex items-center rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive ? 'bg-brand text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              {entry.label}
            </NavLink>
          );
        })}
      </nav>

      {/* ── Sign out ── */}
      <div className="border-t border-slate-700 px-2 py-3 min-w-[224px]">
        <button
          onClick={() => { clearToken(); window.location.href = '/login'; }}
          className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-400 transition hover:bg-slate-800 hover:text-white"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}

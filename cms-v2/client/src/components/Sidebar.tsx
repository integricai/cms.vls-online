import { NavLink } from 'react-router-dom';
import { canManageContent, clearToken, getCurrentUser } from '../api/client';

type Access = 'all' | 'content' | 'admin';

type VaultLink = {
  to: string;
  label: string;
  access: Access;
};

const MAIN_LINKS: VaultLink[] = [
  { to: '/content-migration', label: 'Content Migration', access: 'all' },
  { to: '/courses', label: 'Courses', access: 'admin' },
  { to: '/payments', label: 'Payments', access: 'admin' },
  { to: '/sales', label: 'Sales', access: 'admin' },
  { to: '/students', label: 'Students', access: 'admin' },
  { to: '/google-conversions', label: 'Google Conversions', access: 'admin' },
];

function canSee(access: Access, isAdmin: boolean, canContent: boolean): boolean {
  if (access === 'admin') return isAdmin;
  if (access === 'content') return canContent;
  return true;
}

function linkClass(isActive: boolean) {
  return `mb-1 flex items-center rounded-lg px-3 py-2 text-sm font-medium transition ${
    isActive
      ? 'bg-brand text-white'
      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
  }`;
}

function MenuIcon({ name }: { name: string }) {
  const common = 'mr-2 h-4 w-4 shrink-0';
  if (name === 'Content Migration') {
    return (
      <svg viewBox="0 0 20 20" fill="currentColor" className={common}>
        <path d="M8 2a1 1 0 000 2h2a1 1 0 100-2H8z" />
        <path d="M3 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v6h-4.586l1.293-1.293a1 1 0 00-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L10.414 13H15v3a2 2 0 01-2 2H5a2 2 0 01-2-2V5zM15 11h2a1 1 0 110 2h-2v-2z" />
      </svg>
    );
  }
  if (name === 'Courses') {
    return (
      <svg viewBox="0 0 20 20" fill="currentColor" className={common}>
        <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z" />
      </svg>
    );
  }
  if (name === 'Payments') {
    return (
      <svg viewBox="0 0 20 20" fill="currentColor" className={common}>
        <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
        <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" />
      </svg>
    );
  }
  if (name === 'Sales') {
    return (
      <svg viewBox="0 0 20 20" fill="currentColor" className={common}>
        <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z"
          clipRule="evenodd"
        />
      </svg>
    );
  }
  if (name === 'Students') {
    return (
      <svg viewBox="0 0 20 20" fill="currentColor" className={common}>
        <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
      </svg>
    );
  }
  if (name === 'Google Conversions') {
    return (
      <svg viewBox="0 0 20 20" fill="currentColor" className={common}>
        <path d="M3 3a1 1 0 000 2h1.22l.305 1.222a.998.998 0 00.01.042l1.358 5.43-.893.892C3.74 13.846 4.632 16 6.414 16H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 5H5.28l-.31-1.243A1 1 0 004 3H3z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={common}>
      <path
        fillRule="evenodd"
        d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.53 1.53 0 01-2.29.95c-1.37-.83-2.94.74-2.11 2.11.47.78.05 1.8-.95 2.04-1.56.38-1.56 2.6 0 2.98 1 .24 1.42 1.26.95 2.04-.83 1.37.74 2.94 2.11 2.11.78-.47 1.8-.05 2.04.95.38 1.56 2.6 1.56 2.98 0 .24-1 1.26-1.42 2.04-.95 1.37.83 2.94-.74 2.11-2.11-.47-.78-.05-1.8.95-2.04 1.56-.38 1.56-2.6 0-2.98-1-.24-1.42-1.26-.95-2.04.83-1.37-.74-2.94-2.11-2.11-.78.47-1.8.05-2.04-.95zM10 13a3 3 0 100-6 3 3 0 000 6z"
        clipRule="evenodd"
      />
    </svg>
  );
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: Props) {
  const currentUser = getCurrentUser();
  const isAdmin = currentUser?.role === 'admin';
  const canContent = canManageContent(currentUser?.role);
  const mainLinks = MAIN_LINKS.filter(item => canSee(item.access, isAdmin, canContent));

  return (
    <aside
      className={`flex shrink-0 flex-col overflow-hidden bg-slate-900 text-slate-300 transition-[width] duration-300 ease-in-out ${
        isOpen ? 'w-64' : 'w-0'
      }`}
    >
      <div className="flex min-w-[256px] items-center justify-between border-b border-slate-700 px-4 py-4">
        <span className="text-sm font-bold tracking-wide text-white">Vertex Vault</span>
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

      <nav className="min-w-[256px] flex-1 overflow-y-auto px-2 py-2">
        {mainLinks.map(item => (
          <NavLink key={item.to} to={item.to} end className={({ isActive }) => linkClass(isActive)}>
            <MenuIcon name={item.label} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="min-w-[256px] border-t border-slate-700 px-2 py-3">
        {isAdmin ? (
          <NavLink to="/settings" end className={({ isActive }) => linkClass(isActive)}>
            <MenuIcon name="Settings" />
            Settings
          </NavLink>
        ) : null}
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

import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { clearToken, getCurrentUser } from '../api/client';
const NAV = [
    {
        group: 'Global',
        children: [
            { to: '/header', label: 'Header' },
            { to: '/footer', label: 'Footer' },
            { to: '/banner', label: 'Banner' },
            { to: '/promotion-section', label: 'Promotion Section' },
            { to: '/contact-footer', label: 'Contact Footer' },
        ],
    },
    {
        group: 'Home Page',
        children: [
            { to: '/home-hero', label: 'Hero — Left Pane' },
            { to: '/about-us', label: 'About Us' },
        ],
    },
    {
        group: 'Course Page',
        children: [
            { to: '/course-hero', label: 'Left Hero Section' },
            { to: '/course-hero-right', label: 'Right Hero Section' },
            { to: '/course-desc', label: 'Course Description' },
            { to: '/course-tabs', label: 'Course Tabs' },
            { to: '/hero-section-v2', label: 'Hero Section V2' },
        ],
    },
    {
        group: 'Page Templates',
        children: [
            { to: '/events', label: 'Events' },
            { to: '/articles', label: 'Articles' },
            { to: '/legal-page', label: 'Legal Page' },
            { to: '/team', label: 'Team' },
        ],
    },
    {
        group: 'Site wide Sections',
        children: [
            { to: '/faq', label: 'FAQ' },
        ],
    },
    {
        group: 'Page Builder',
        children: [
            {
                sub: 'Full Screen Sections',
                children: [
                    { to: '/full-screen/dcs', label: 'Two Column v1' },
                    { to: '/full-screen/dcs2', label: 'Two Column v2' },
                    { to: '/full-screen/dcs3', label: 'Two Column v3' },
                    { to: '/full-screen/reach', label: 'Global Reach' },
                    { to: '/full-screen/hero-banner', label: 'Hero Banner' },
                    { to: '/full-screen/hero-banner-v2', label: 'Hero Banner v2' },
                ],
            },
            {
                sub: 'Split Screen Sections',
                children: [
                    { to: '/split-screen/left-hero', label: 'Left Hero Section' },
                    { to: '/split-screen/left-generic', label: 'Left Generic Section' },
                    { to: '/split-screen/right-pane', label: 'Right Pane Section' },
                ],
            },
        ],
    },
    {
        group: 'Cards',
        children: [
            { to: '/program-cards', label: 'Program Cards' },
            { to: '/program-cards-v2', label: 'Program Cards v2' },
            { to: '/feature-cards', label: 'Feature Cards' },
            { to: '/feature-cards-v2', label: 'Feature Card v2' },
            { to: '/feature-cards-v3', label: 'Feature Card v3' },
            { to: '/step-cards', label: 'Step Cards' },
        ],
    },
];
export default function Sidebar({ isOpen, onClose }) {
    const [openGroup, setOpenGroup] = useState(null);
    const currentUser = getCurrentUser();
    const canManageUsers = currentUser?.role === 'admin';
    function toggleGroup(name) {
        setOpenGroup(prev => prev === name ? null : name);
    }
    function renderGroupChildren(children) {
        return children.map((child, j) => {
            if ('sub' in child) {
                return (_jsxs("div", { children: [_jsx("div", { className: "px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500", children: child.sub }), child.children.length > 0 && (_jsx("div", { className: "ml-3 mb-1 space-y-0.5 border-l border-slate-700 pl-2", children: child.children.map(item => (_jsx(NavLink, { to: item.to, className: ({ isActive }) => `flex items-center rounded-lg px-3 py-2 text-sm font-medium transition ${isActive
                                    ? 'bg-brand text-white'
                                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`, children: item.label }, item.to))) }))] }, j));
            }
            return (_jsx(NavLink, { to: child.to, className: ({ isActive }) => `flex items-center rounded-lg px-3 py-2 text-sm font-medium transition ${isActive
                    ? 'bg-brand text-white'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`, children: child.label }, child.to));
        });
    }
    return (_jsxs("aside", { className: `flex flex-col bg-slate-900 text-slate-300 transition-[width] duration-300 ease-in-out overflow-hidden shrink-0 ${isOpen ? 'w-56' : 'w-0'}`, children: [_jsxs("div", { className: "flex items-center justify-between border-b border-slate-700 px-4 py-4 min-w-[224px]", children: [_jsx("span", { className: "text-sm font-bold text-white tracking-wide", children: "VLS CMS" }), _jsx("button", { onClick: onClose, title: "Collapse sidebar", className: "flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-700 hover:text-white", children: _jsx("svg", { viewBox: "0 0 20 20", fill: "currentColor", className: "h-4 w-4", children: _jsx("path", { fillRule: "evenodd", d: "M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z", clipRule: "evenodd" }) }) })] }), _jsx("nav", { className: "flex-1 overflow-y-auto py-2 px-2 min-w-[224px]", children: NAV.map((entry, i) => {
                    if ('group' in entry) {
                        const expanded = openGroup === entry.group;
                        return (_jsxs("div", { children: [_jsxs("button", { onClick: () => toggleGroup(entry.group), className: "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition hover:bg-slate-800", children: [_jsx("span", { className: "text-[11px] font-semibold uppercase tracking-widest text-slate-400", children: entry.group }), _jsx("svg", { viewBox: "0 0 20 20", fill: "currentColor", className: `h-3.5 w-3.5 text-slate-500 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`, children: _jsx("path", { fillRule: "evenodd", d: "M7.293 4.293a1 1 0 011.414 0l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414-1.414L11.586 10 7.293 5.707a1 1 0 010-1.414z", clipRule: "evenodd" }) })] }), _jsx("div", { className: `overflow-hidden transition-[max-height] duration-200 ease-in-out ${expanded ? 'max-h-[480px]' : 'max-h-0'}`, children: _jsx("div", { className: "ml-3 mt-0.5 mb-1 space-y-0.5 border-l border-slate-700 pl-2", children: renderGroupChildren(entry.children) }) })] }, i));
                    }
                    return (_jsx(NavLink, { to: entry.to, className: ({ isActive }) => `flex items-center rounded-lg px-3 py-2 text-sm font-medium transition ${isActive ? 'bg-brand text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`, children: entry.label }, entry.to));
                }) }), _jsxs("div", { className: "border-t border-slate-700 px-2 py-3 min-w-[224px]", children: [canManageUsers && (_jsxs(NavLink, { to: "/settings/users", title: "Settings", className: ({ isActive }) => `mb-2 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${isActive ? 'bg-brand text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`, children: [_jsx("svg", { viewBox: "0 0 20 20", fill: "currentColor", className: "h-4 w-4", children: _jsx("path", { fillRule: "evenodd", d: "M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.53 1.53 0 01-2.29.95c-1.37-.83-2.94.74-2.11 2.11.47.78.05 1.8-.95 2.04-1.56.38-1.56 2.6 0 2.98 1 .24 1.42 1.26.95 2.04-.83 1.37.74 2.94 2.11 2.11.78-.47 1.8-.05 2.04.95.38 1.56 2.6 1.56 2.98 0 .24-1 1.26-1.42 2.04-.95 1.37.83 2.94-.74 2.11-2.11-.47-.78-.05-1.8.95-2.04 1.56-.38 1.56-2.6 0-2.98-1-.24-1.42-1.26-.95-2.04.83-1.37-.74-2.94-2.11-2.11-.78.47-1.8.05-2.04-.95zM10 13a3 3 0 100-6 3 3 0 000 6z", clipRule: "evenodd" }) }), "Settings"] })), _jsx("button", { onClick: () => { clearToken(); window.location.href = '/login'; }, className: "w-full rounded-lg px-3 py-2 text-left text-sm text-slate-400 transition hover:bg-slate-800 hover:text-white", children: "Sign out" })] })] }));
}

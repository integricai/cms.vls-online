import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { api } from '../../api/client';
import Field from '../../components/Field';
import RichTextField from '../../components/RichTextField';
import { normalize } from '../../utils/text';
import { generateContactFormHtml, generateContactPageHtml, generateReportIssueHtml, generateReportTyHtml } from './generateHtml';
import { wrapGeneratedHtml } from '../../utils/htmlComments';
const CONFIG = {
    contact: { title: 'Contact Form', key: 'vls-form-config' },
    'report-issue': { title: 'Report an Issue', key: 'vls-report-config' },
    'report-issue-ty': { title: 'Report an Issue - TY', key: 'vls-report-ty-config' },
    'contact-page': { title: 'Contact Page Form', key: 'vls-contact-page-config' },
};
function newId(prefix) {
    return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}
function defaultConfig(type) {
    if (type === 'contact') {
        return {
            formTitle: normalize('Course Enquiry Form', 'formTitle'),
            submitText: normalize('Submit Form', 'formButton'),
            thankTitle: normalize('Form submitted', 'formThankTitle'),
            thankDesc: normalize('Thank you for sharing the information. We will contact you soon.', 'formThank'),
            recipients: ['office@vls-online.com'],
            enquiryOptions: [],
            messageRows: 4,
            messageMinHeight: 120,
        };
    }
    if (type === 'contact-page') {
        return {
            formLabel: 'SEND US A MESSAGE',
            formSubheader: "We'll respond within 1 working day",
            submitText: 'Send Message →',
            thankTitle: 'Message sent!',
            thankDesc: "Thank you for reaching out. We'll be in touch within 1 working day.",
            privacyUrl: '/privacy',
            recipients: ['office@vls-online.com'],
            enquiryOptions: [],
            messageRows: 5,
            messageMinHeight: 140,
            qualificationOptions: ['ACCA', 'CIMA', 'CMA', 'CIA', 'Dip-IFR', 'Foundation Diploma', 'Not sure yet'],
            howHeardOptions: [],
            companyName: '',
            contactInfoLabel: 'CONTACT INFORMATION',
            contactItems: [],
            supportHoursLabel: 'SUPPORT HOURS',
            supportHours: [],
            responseNote: '',
            followLabel: 'FOLLOW VLS',
            socialLinks: [],
            faqTitle: '',
            faqDesc: '',
            faqBtnText: 'View FAQs →',
            faqBtnUrl: '',
        };
    }
    if (type === 'report-issue-ty') {
        return {
            heroBg: '#0d1f3c', iconBg: '#1e3a5f', heading: 'Report Received', subtitle: "Thank you for getting in touch - we're on it.",
            refLabel: 'YOUR REFERENCE NUMBER', stepsLabel: 'WHAT HAPPENS NEXT', fuTitle: 'Need to follow up sooner?', fuDesc: '',
            btn1Text: 'Back to home', btn1Url: '/', btn1Bg: '#0d1f3c', btn1Tc: '#ffffff',
            btn2Text: 'Browse all courses', btn2Url: '/courses/', btn2Bc: '#204280', btn2Tc: '#204280',
            steps: [], contacts: [],
        };
    }
    return {
        recipients: ['office@vls-online.com'], heroBg: '#0d1f3c', heroEyebrow: 'STUDENT SUPPORT', eyebrowTc: '#72cdf4',
        heroTitle: 'Report an Issue', titleTc: '#ffffff', heroDesc: '', descTc: '#94a3b8',
        sidebarW: '300', sidebarBg: '#f8fafc', hiwEyebrow: 'HOW IT WORKS', hiwHeading: '', hiwDesc: '',
        contactTitle: 'Prefer to contact us directly?', contactBg: '#0d1f3c', accent: '#204280',
        btnText: 'Submit Report', tyUrl: '', steps: [], cards: [], contactItems: [], qualifications: [], issueTypes: [],
    };
}
function ColorInput({ label, value, onChange }) {
    return (_jsx(Field, { label: label, children: _jsxs("div", { className: "flex gap-2", children: [_jsx("input", { type: "color", value: /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#000000', onChange: e => onChange(e.target.value), className: "h-9 w-10 rounded border border-slate-200 p-0.5" }), _jsx("input", { className: "input", value: value || '', onChange: e => onChange(e.target.value) })] }) }));
}
function StringList({ label, items, onChange, placeholder }) {
    return (_jsxs("div", { className: "mb-4", children: [_jsxs("div", { className: "mb-2 flex items-center justify-between", children: [_jsx("p", { className: "section-label m-0 border-0 p-0", children: label }), _jsx("button", { className: "btn-ghost px-2 py-1 text-xs", onClick: () => onChange([...(items || []), '']), children: "+ Add" })] }), (items || []).map((item, index) => (_jsxs("div", { className: "mb-2 grid grid-cols-[1fr_auto_auto_auto] gap-2", children: [_jsx("input", { className: "input", value: item, placeholder: placeholder, onChange: e => {
                            const next = [...items];
                            next[index] = e.target.value;
                            onChange(next);
                        } }), _jsx("button", { className: "btn-ghost px-2 py-1 text-xs", disabled: index === 0, onClick: () => {
                            const next = [...items];
                            [next[index - 1], next[index]] = [next[index], next[index - 1]];
                            onChange(next);
                        }, children: "Up" }), _jsx("button", { className: "btn-ghost px-2 py-1 text-xs", disabled: index === items.length - 1, onClick: () => {
                            const next = [...items];
                            [next[index + 1], next[index]] = [next[index], next[index + 1]];
                            onChange(next);
                        }, children: "Down" }), _jsx("button", { className: "btn-danger", onClick: () => onChange(items.filter((_, i) => i !== index)), children: "Remove" })] }, index)))] }));
}
function ObjectList({ label, items, fields, makeItem, onChange }) {
    return (_jsxs("div", { className: "mb-4", children: [_jsxs("div", { className: "mb-2 flex items-center justify-between", children: [_jsx("p", { className: "section-label m-0 border-0 p-0", children: label }), _jsx("button", { className: "btn-ghost px-2 py-1 text-xs", onClick: () => onChange([...(items || []), makeItem()]), children: "+ Add" })] }), (items || []).map((item, index) => (_jsxs("div", { className: "mb-2 rounded-lg border border-slate-100 bg-slate-50 p-3", children: [_jsxs("div", { className: "mb-2 flex justify-end gap-2", children: [_jsx("button", { className: "btn-ghost px-2 py-1 text-xs", disabled: index === 0, onClick: () => {
                                    const next = [...items];
                                    [next[index - 1], next[index]] = [next[index], next[index - 1]];
                                    onChange(next);
                                }, children: "Up" }), _jsx("button", { className: "btn-ghost px-2 py-1 text-xs", disabled: index === items.length - 1, onClick: () => {
                                    const next = [...items];
                                    [next[index + 1], next[index]] = [next[index], next[index + 1]];
                                    onChange(next);
                                }, children: "Down" }), _jsx("button", { className: "btn-danger", onClick: () => onChange(items.filter((_, i) => i !== index)), children: "Remove" })] }), fields.map(field => (_jsx(Field, { label: field, children: _jsx("input", { className: "input", value: item[field] || '', onChange: e => {
                                const next = [...items];
                                next[index] = { ...next[index], [field]: e.target.value };
                                onChange(next);
                            } }) }, field)))] }, index)))] }));
}
function OutputPane({ html, tab, setTab }) {
    return (_jsxs("div", { className: "flex flex-1 flex-col overflow-hidden", children: [_jsx("div", { className: "flex border-b border-slate-200 bg-white px-4", children: ['preview', 'html'].map(t => (_jsx("button", { onClick: () => setTab(t), className: `-mb-px border-b-2 px-4 py-3 text-sm font-medium ${tab === t ? 'border-brand text-brand' : 'border-transparent text-slate-400 hover:text-slate-700'}`, children: t === 'html' ? 'HTML' : 'Preview' }, t))) }), tab === 'preview' ? (_jsx("iframe", { title: "Form preview", srcDoc: html ? `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:24px;background:#f3f4f6">${html}</body></html>` : '<p style="font-family:sans-serif;color:#94a3b8;padding:24px">Generate HTML to preview.</p>', className: "h-full w-full flex-1 border-0 bg-slate-50", sandbox: "allow-scripts" })) : (_jsxs("div", { className: "relative flex-1 overflow-auto bg-slate-900 p-4", children: [_jsx("button", { onClick: () => navigator.clipboard.writeText(html), className: "absolute right-4 top-4 rounded bg-slate-700 px-3 py-1 text-xs text-slate-300 hover:bg-slate-600", children: "Copy" }), _jsx("pre", { className: "whitespace-pre-wrap font-mono text-xs leading-relaxed text-slate-300", children: html || '// Generate HTML first' })] }))] }));
}
function ContactFields({ cfg, patch }) {
    return (_jsxs(_Fragment, { children: [_jsx(RichTextField, { label: "Form title", value: normalize(cfg.formTitle, 'formTitle'), defaultKey: "formTitle", onChange: formTitle => patch({ formTitle }) }), _jsx(RichTextField, { label: "Submit button text", value: normalize(cfg.submitText, 'formButton'), defaultKey: "formButton", onChange: submitText => patch({ submitText }) }), _jsx("p", { className: "section-label", children: "Message Box" }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx(Field, { label: "Rows", children: _jsx("input", { type: "number", className: "input", min: 2, max: 20, value: cfg.messageRows ?? 4, onChange: e => patch({ messageRows: Number(e.target.value) }) }) }), _jsx(Field, { label: "Minimum height (px)", children: _jsx("input", { type: "number", className: "input", min: 80, max: 600, value: cfg.messageMinHeight ?? 120, onChange: e => patch({ messageMinHeight: Number(e.target.value) }) }) })] }), _jsx("p", { className: "section-label", children: "Thank You Message" }), _jsx(RichTextField, { label: "Title", value: normalize(cfg.thankTitle, 'formThankTitle'), defaultKey: "formThankTitle", onChange: thankTitle => patch({ thankTitle }) }), _jsx(RichTextField, { label: "Description", multiline: true, value: normalize(cfg.thankDesc, 'formThank'), defaultKey: "formThank", onChange: thankDesc => patch({ thankDesc }) }), _jsx(StringList, { label: "Recipients", items: cfg.recipients || [], placeholder: "office@example.com", onChange: recipients => patch({ recipients }) }), _jsx(ObjectList, { label: "Enquiry Options", items: cfg.enquiryOptions || [], fields: ['label'], makeItem: () => ({ id: newId('eq'), label: '' }), onChange: enquiryOptions => patch({ enquiryOptions }) })] }));
}
function ReportFields({ cfg, patch }) {
    return (_jsxs(_Fragment, { children: [_jsx(StringList, { label: "Notification Recipients", items: cfg.recipients || [], placeholder: "office@example.com", onChange: recipients => patch({ recipients }) }), _jsx("p", { className: "section-label", children: "Hero" }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx(Field, { label: "Eyebrow", children: _jsx("input", { className: "input", value: cfg.heroEyebrow || '', onChange: e => patch({ heroEyebrow: e.target.value }) }) }), _jsx(ColorInput, { label: "Hero background", value: cfg.heroBg || '#0d1f3c', onChange: heroBg => patch({ heroBg }) }), _jsx(ColorInput, { label: "Eyebrow colour", value: cfg.eyebrowTc || '#72cdf4', onChange: eyebrowTc => patch({ eyebrowTc }) }), _jsx(ColorInput, { label: "Title colour", value: cfg.titleTc || '#ffffff', onChange: titleTc => patch({ titleTc }) })] }), _jsx(Field, { label: "Title", children: _jsx("input", { className: "input", value: cfg.heroTitle || '', onChange: e => patch({ heroTitle: e.target.value }) }) }), _jsx(Field, { label: "Description", children: _jsx("textarea", { className: "input", rows: 3, value: cfg.heroDesc || '', onChange: e => patch({ heroDesc: e.target.value }) }) }), _jsx("p", { className: "section-label", children: "Left Sidebar" }), _jsx(Field, { label: "How it works heading", children: _jsx("input", { className: "input", value: cfg.hiwHeading || '', onChange: e => patch({ hiwHeading: e.target.value }) }) }), _jsx(Field, { label: "How it works description", children: _jsx("textarea", { className: "input", rows: 3, value: cfg.hiwDesc || '', onChange: e => patch({ hiwDesc: e.target.value }) }) }), _jsx(ObjectList, { label: "Steps", items: cfg.steps || [], fields: ['title', 'desc'], makeItem: () => ({ title: '', desc: '' }), onChange: steps => patch({ steps }) }), _jsx(ObjectList, { label: "Feature Cards", items: cfg.cards || [], fields: ['icon', 'title', 'desc'], makeItem: () => ({ icon: '', title: '', desc: '' }), onChange: cards => patch({ cards }) }), _jsx(StringList, { label: "Contact Items", items: cfg.contactItems || [], onChange: contactItems => patch({ contactItems }) }), _jsx("p", { className: "section-label", children: "Form Options" }), _jsx(ColorInput, { label: "Accent", value: cfg.accent || '#204280', onChange: accent => patch({ accent }) }), _jsx(Field, { label: "Submit button text", children: _jsx("input", { className: "input", value: cfg.btnText || '', onChange: e => patch({ btnText: e.target.value }) }) }), _jsx(Field, { label: "Thank you URL", children: _jsx("input", { className: "input", value: cfg.tyUrl || '', onChange: e => patch({ tyUrl: e.target.value }) }) }), _jsx(StringList, { label: "Qualification Options", items: cfg.qualifications || [], onChange: qualifications => patch({ qualifications }) }), _jsx(StringList, { label: "Issue Type Options", items: cfg.issueTypes || [], onChange: issueTypes => patch({ issueTypes }) })] }));
}
function ContactPageFields({ cfg, patch }) {
    return (_jsxs(_Fragment, { children: [_jsx("p", { className: "section-label", children: "Form Header" }), _jsx(Field, { label: "Label (e.g. SEND US A MESSAGE)", children: _jsx("input", { className: "input", value: cfg.formLabel || '', onChange: e => patch({ formLabel: e.target.value }) }) }), _jsx(Field, { label: "Subheader", children: _jsx("input", { className: "input", value: cfg.formSubheader || '', onChange: e => patch({ formSubheader: e.target.value }) }) }), _jsx(Field, { label: "Submit button text", children: _jsx("input", { className: "input", value: cfg.submitText || '', onChange: e => patch({ submitText: e.target.value }) }) }), _jsx(Field, { label: "Privacy policy URL", children: _jsx("input", { className: "input", value: cfg.privacyUrl || '', onChange: e => patch({ privacyUrl: e.target.value }) }) }), _jsx("p", { className: "section-label", children: "Message Box" }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx(Field, { label: "Rows", children: _jsx("input", { type: "number", className: "input", min: 2, max: 20, value: cfg.messageRows ?? 5, onChange: e => patch({ messageRows: Number(e.target.value) }) }) }), _jsx(Field, { label: "Minimum height (px)", children: _jsx("input", { type: "number", className: "input", min: 80, max: 700, value: cfg.messageMinHeight ?? 140, onChange: e => patch({ messageMinHeight: Number(e.target.value) }) }) })] }), _jsx("p", { className: "section-label", children: "Thank You Message" }), _jsx(Field, { label: "Title", children: _jsx("input", { className: "input", value: cfg.thankTitle || '', onChange: e => patch({ thankTitle: e.target.value }) }) }), _jsx(Field, { label: "Description", children: _jsx("textarea", { className: "input", rows: 2, value: cfg.thankDesc || '', onChange: e => patch({ thankDesc: e.target.value }) }) }), _jsx(StringList, { label: "Recipients", items: cfg.recipients || [], placeholder: "office@example.com", onChange: recipients => patch({ recipients }) }), _jsx(ObjectList, { label: "Enquiry Topic Options", items: cfg.enquiryOptions || [], fields: ['label'], makeItem: () => ({ id: newId('eq'), label: '' }), onChange: enquiryOptions => patch({ enquiryOptions }) }), _jsx(StringList, { label: "Qualification Buttons", items: cfg.qualificationOptions || [], placeholder: "ACCA", onChange: qualificationOptions => patch({ qualificationOptions }) }), _jsx(StringList, { label: "How Did You Hear Options", items: cfg.howHeardOptions || [], placeholder: "Google / Search engine", onChange: howHeardOptions => patch({ howHeardOptions }) }), _jsx("p", { className: "section-label", children: "Contact Info Panel" }), _jsx(Field, { label: "Contact info label", children: _jsx("input", { className: "input", value: cfg.contactInfoLabel || '', onChange: e => patch({ contactInfoLabel: e.target.value }) }) }), _jsx(Field, { label: "Company name", children: _jsx("input", { className: "input", value: cfg.companyName || '', onChange: e => patch({ companyName: e.target.value }) }) }), _jsx(ObjectList, { label: "Contact Items", items: cfg.contactItems || [], fields: ['icon', 'label', 'value', 'subtext', 'url'], makeItem: () => ({ icon: '📧', label: '', value: '', subtext: '', url: '' }), onChange: contactItems => patch({ contactItems }) }), _jsx("p", { className: "section-label", children: "Support Hours" }), _jsx(Field, { label: "Section label", children: _jsx("input", { className: "input", value: cfg.supportHoursLabel || '', onChange: e => patch({ supportHoursLabel: e.target.value }) }) }), _jsx(ObjectList, { label: "Hours rows", items: cfg.supportHours || [], fields: ['day', 'hours'], makeItem: () => ({ day: '', hours: '' }), onChange: supportHours => patch({ supportHours }) }), _jsx(Field, { label: "Response note", children: _jsx("textarea", { className: "input", rows: 2, value: cfg.responseNote || '', onChange: e => patch({ responseNote: e.target.value }) }) }), _jsx("p", { className: "section-label", children: "Social Links" }), _jsx(Field, { label: "Section label", children: _jsx("input", { className: "input", value: cfg.followLabel || '', onChange: e => patch({ followLabel: e.target.value }) }) }), _jsx(ObjectList, { label: "Social links", items: cfg.socialLinks || [], fields: ['platform', 'handle', 'url', 'icon'], makeItem: () => ({ platform: '', handle: '', url: '', icon: '🔗' }), onChange: socialLinks => patch({ socialLinks }) }), _jsx("p", { className: "section-label", children: "FAQ Callout" }), _jsx(Field, { label: "Title", children: _jsx("input", { className: "input", value: cfg.faqTitle || '', onChange: e => patch({ faqTitle: e.target.value }) }) }), _jsx(Field, { label: "Description", children: _jsx("input", { className: "input", value: cfg.faqDesc || '', onChange: e => patch({ faqDesc: e.target.value }) }) }), _jsx(Field, { label: "Button text", children: _jsx("input", { className: "input", value: cfg.faqBtnText || '', onChange: e => patch({ faqBtnText: e.target.value }) }) }), _jsx(Field, { label: "Button URL", children: _jsx("input", { className: "input", value: cfg.faqBtnUrl || '', onChange: e => patch({ faqBtnUrl: e.target.value }) }) })] }));
}
function ReportTyFields({ cfg, patch }) {
    return (_jsxs(_Fragment, { children: [_jsx("p", { className: "section-label", children: "Hero" }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx(ColorInput, { label: "Hero background", value: cfg.heroBg || '#0d1f3c', onChange: heroBg => patch({ heroBg }) }), _jsx(ColorInput, { label: "Icon background", value: cfg.iconBg || '#1e3a5f', onChange: iconBg => patch({ iconBg }) })] }), _jsx(Field, { label: "Heading", children: _jsx("input", { className: "input", value: cfg.heading || '', onChange: e => patch({ heading: e.target.value }) }) }), _jsx(Field, { label: "Subtitle", children: _jsx("input", { className: "input", value: cfg.subtitle || '', onChange: e => patch({ subtitle: e.target.value }) }) }), _jsx(Field, { label: "Reference label", children: _jsx("input", { className: "input", value: cfg.refLabel || '', onChange: e => patch({ refLabel: e.target.value }) }) }), _jsx(ObjectList, { label: "What Happens Next", items: cfg.steps || [], fields: ['title', 'desc', 'badge'], makeItem: () => ({ title: '', desc: '', badge: '' }), onChange: steps => patch({ steps }) }), _jsx("p", { className: "section-label", children: "Follow-up Box" }), _jsx(Field, { label: "Title", children: _jsx("input", { className: "input", value: cfg.fuTitle || '', onChange: e => patch({ fuTitle: e.target.value }) }) }), _jsx(Field, { label: "Description", children: _jsx("input", { className: "input", value: cfg.fuDesc || '', onChange: e => patch({ fuDesc: e.target.value }) }) }), _jsx(StringList, { label: "Contact Items", items: cfg.contacts || [], onChange: contacts => patch({ contacts }) }), _jsx("p", { className: "section-label", children: "Buttons" }), _jsx(Field, { label: "Button 1 text", children: _jsx("input", { className: "input", value: cfg.btn1Text || '', onChange: e => patch({ btn1Text: e.target.value }) }) }), _jsx(Field, { label: "Button 1 URL", children: _jsx("input", { className: "input", value: cfg.btn1Url || '', onChange: e => patch({ btn1Url: e.target.value }) }) }), _jsx(Field, { label: "Button 2 text", children: _jsx("input", { className: "input", value: cfg.btn2Text || '', onChange: e => patch({ btn2Text: e.target.value }) }) }), _jsx(Field, { label: "Button 2 URL", children: _jsx("input", { className: "input", value: cfg.btn2Url || '', onChange: e => patch({ btn2Url: e.target.value }) }) })] }));
}
export default function Forms() {
    const params = useParams();
    const type = params.type;
    const config = type ? CONFIG[type] : null;
    const contentKey = config?.key;
    const [state, setState] = useState(() => defaultConfig(type || 'contact'));
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [html, setHtml] = useState('');
    const [tab, setTab] = useState('preview');
    useEffect(() => {
        if (!type || !contentKey)
            return;
        setLoading(true);
        api.get(`/content/${contentKey}`)
            .then(row => setState({ ...defaultConfig(type), ...(row?.data?.config || {}) }))
            .finally(() => setLoading(false));
    }, [type, contentKey]);
    if (!type || !config)
        return _jsx(Navigate, { to: "/forms/contact", replace: true });
    function patch(partial) {
        setState(prev => ({ ...prev, ...partial }));
        setSaved(false);
    }
    async function save() {
        setSaving(true);
        await api.put(`/content/${contentKey}`, { config: state });
        setSaving(false);
        setSaved(true);
    }
    function generate() {
        const next = type === 'contact'
            ? generateContactFormHtml(state)
            : type === 'contact-page'
                ? generateContactPageHtml(state)
                : type === 'report-issue'
                    ? generateReportIssueHtml(state)
                    : generateReportTyHtml(state);
        setHtml(wrapGeneratedHtml(config?.title || 'Forms', next));
        setTab('preview');
    }
    if (loading)
        return _jsx("div", { className: "p-5 text-sm text-slate-400", children: "Loading..." });
    return (_jsxs("div", { className: "flex h-full", children: [_jsxs("div", { className: "w-[520px] shrink-0 overflow-y-auto border-r border-slate-200 bg-white", children: [_jsxs("div", { className: "sticky top-0 z-10 border-b border-slate-100 bg-white px-5 py-4", children: [_jsx("h1", { className: "text-base font-bold text-slate-900", children: config.title }), _jsx("p", { className: "mt-0.5 text-xs text-slate-400", children: "Forms" }), _jsxs("div", { className: "mt-4 flex gap-2", children: [_jsx("button", { className: "btn-primary flex-1 justify-center", disabled: saving, onClick: save, children: saving ? 'Saving...' : saved ? 'Saved' : 'Save' }), _jsx("button", { className: "btn-success flex-1 justify-center", onClick: generate, children: "Generate HTML" })] })] }), _jsxs("div", { className: "px-5 py-4", children: [type === 'contact' && _jsx(ContactFields, { cfg: state, patch: patch }), type === 'contact-page' && _jsx(ContactPageFields, { cfg: state, patch: patch }), type === 'report-issue' && _jsx(ReportFields, { cfg: state, patch: patch }), type === 'report-issue-ty' && _jsx(ReportTyFields, { cfg: state, patch: patch })] })] }), _jsx(OutputPane, { html: html, tab: tab, setTab: setTab })] }));
}

import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api/client';
import Field from '../../components/Field';
import { generateBlogArticleHtml, generateBlogLandingHtml, blogUrl } from './generateHtml';
import { wrapGeneratedHtml } from '../../utils/htmlComments';
const TOPICS = ['ACCA', 'Accounting', 'Finance', 'Tax', 'Audit', 'Study Tips', 'Exam Preparation', 'Career Advice'];
function statusClass(type) {
    return {
        success: 'border-green-200 bg-green-50 text-green-800',
        error: 'border-red-200 bg-red-50 text-red-800',
        warning: 'border-amber-200 bg-amber-50 text-amber-800',
        info: 'border-blue-200 bg-blue-50 text-blue-800',
    }[type];
}
function formatDate(value) {
    if (!value)
        return 'No date';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-GB');
}
export default function Blog() {
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sourceUrl, setSourceUrl] = useState('');
    const [topicOverride, setTopicOverride] = useState('');
    const [slugOverride, setSlugOverride] = useState('');
    const [status, setStatus] = useState('published');
    const [importing, setImporting] = useState(false);
    const [message, setMessage] = useState(null);
    const [duplicate, setDuplicate] = useState(null);
    const [selectedId, setSelectedId] = useState('');
    const [tab, setTab] = useState('landing');
    const [topicFilter, setTopicFilter] = useState('All');
    const [query, setQuery] = useState('');
    useEffect(() => {
        api.get('/blog/posts')
            .then(data => {
            setPosts(data);
            setSelectedId(data[0]?.id || '');
        })
            .catch(err => setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to load blog posts' }))
            .finally(() => setLoading(false));
    }, []);
    const selected = posts.find(post => post.id === selectedId) || posts[0] || null;
    const topics = useMemo(() => ['All', ...Array.from(new Set([...TOPICS, ...posts.map(post => post.topic)])).filter(Boolean)], [posts]);
    const filteredPosts = posts.filter(post => {
        const topicOk = topicFilter === 'All' || post.topic === topicFilter;
        const haystack = `${post.title} ${post.summary} ${post.topic} ${post.tags.join(' ')}`.toLowerCase();
        return topicOk && (!query.trim() || haystack.includes(query.toLowerCase()));
    });
    const landingHtml = wrapGeneratedHtml('Blog Landing', generateBlogLandingHtml(posts));
    const articleHtml = selected ? wrapGeneratedHtml('Blog Article', generateBlogArticleHtml(selected)) : '';
    const visibleHtml = tab === 'article' ? articleHtml : landingHtml;
    async function loadPosts(nextSelectedId) {
        const data = await api.get('/blog/posts');
        setPosts(data);
        setSelectedId(nextSelectedId || data[0]?.id || '');
    }
    async function runImport(force = false) {
        setImporting(true);
        setDuplicate(null);
        setMessage({ type: 'info', text: 'Importing blog post...' });
        try {
            const result = await api.post('/blog/import', {
                sourceUrl,
                topicOverride: topicOverride || undefined,
                slugOverride: slugOverride || undefined,
                status,
                force,
                updatePostId: duplicate?.id,
            });
            await loadPosts(result.post.id);
            setSourceUrl('');
            setSlugOverride('');
            setTopicOverride('');
            setDuplicate(null);
            setMessage({
                type: result.warnings.length ? 'warning' : 'success',
                text: result.warnings.length
                    ? `Imported, but ${result.warnings.length} image issue(s): ${result.warnings.join(' | ')}`
                    : `Imported successfully: ${result.post.url || blogUrl(result.post)}`,
            });
            setTab('article');
        }
        catch (err) {
            const text = err instanceof Error ? err.message : 'Import failed';
            setMessage({ type: text.toLowerCase().includes('already') || text.toLowerCase().includes('slug') ? 'warning' : 'error', text });
            const maybeDuplicate = err instanceof Error && 'data' in err ? err.data : null;
            if (maybeDuplicate)
                setDuplicate(maybeDuplicate);
        }
        finally {
            setImporting(false);
        }
    }
    async function updateSelected(partial) {
        if (!selected)
            return;
        const updated = await api.patch(`/blog/posts/${selected.id}`, partial);
        setPosts(items => items.map(post => post.id === updated.id ? updated : post));
        setSelectedId(updated.id);
        setMessage({ type: 'success', text: 'Blog post updated' });
    }
    if (loading)
        return _jsx("div", { className: "flex h-full items-center justify-center text-sm text-slate-400", children: "Loading blog posts..." });
    return (_jsxs("div", { className: "flex h-full", children: [_jsxs("div", { className: "w-[500px] shrink-0 overflow-y-auto border-r border-slate-200 bg-white", children: [_jsxs("div", { className: "sticky top-0 z-10 border-b border-slate-100 bg-white px-5 py-4", children: [_jsx("h1", { className: "text-base font-bold text-slate-900", children: "Blog Import" }), _jsx("p", { className: "mt-0.5 text-xs text-slate-400", children: "Scrape, store and publish VLS blog posts" })] }), _jsxs("div", { className: "border-b border-slate-100 px-5 py-4", children: [_jsx("p", { className: "section-label mt-0", children: "Import Blog URL" }), _jsx(Field, { label: "Source URL", children: _jsx("input", { className: "input", value: sourceUrl, placeholder: "https://blog.vls-online.com/post/...", onChange: event => setSourceUrl(event.target.value) }) }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx(Field, { label: "Topic override", children: _jsxs("select", { className: "input", value: topicOverride, onChange: event => setTopicOverride(event.target.value), children: [_jsx("option", { value: "", children: "Auto detect" }), TOPICS.map(topic => _jsx("option", { value: topic, children: topic }, topic))] }) }), _jsx(Field, { label: "Status", children: _jsxs("select", { className: "input", value: status, onChange: event => setStatus(event.target.value), children: [_jsx("option", { value: "published", children: "Published" }), _jsx("option", { value: "draft", children: "Draft" })] }) })] }), _jsx(Field, { label: "Slug override", hint: "optional", children: _jsx("input", { className: "input", value: slugOverride, placeholder: "afm-common-mistakes-guide-2026", onChange: event => setSlugOverride(event.target.value) }) }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { disabled: importing || !sourceUrl.trim(), className: "btn-primary flex-1 justify-center", onClick: () => runImport(false), children: importing ? 'Importing...' : 'Import' }), duplicate && (_jsx("button", { disabled: importing, className: "btn-success justify-center", onClick: () => runImport(true), children: "Update existing" }))] }), message && _jsx("div", { className: `mt-3 rounded-lg border p-3 text-xs leading-relaxed ${statusClass(message.type)}`, children: message.text }), duplicate && _jsxs("div", { className: "mt-2 text-xs text-slate-500", children: ["Duplicate: ", duplicate.title, " (", duplicate.url || blogUrl(duplicate), ")"] })] }), _jsxs("div", { className: "px-5 py-4", children: [_jsx("p", { className: "section-label mt-0", children: "Blog Library" }), _jsxs("div", { className: "mb-3 grid grid-cols-[1fr_130px] gap-2", children: [_jsx("input", { className: "input", value: query, placeholder: "Search saved posts", onChange: event => setQuery(event.target.value) }), _jsx("select", { className: "input", value: topicFilter, onChange: event => setTopicFilter(event.target.value), children: topics.map(topic => _jsx("option", { value: topic, children: topic }, topic)) })] }), _jsxs("div", { className: "space-y-2", children: [filteredPosts.map(post => (_jsxs("button", { className: `w-full rounded-lg border p-3 text-left transition ${selected?.id === post.id ? 'border-brand bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`, onClick: () => {
                                            setSelectedId(post.id);
                                            setTab('article');
                                        }, children: [_jsxs("div", { className: "flex items-start justify-between gap-3", children: [_jsx("strong", { className: "text-sm text-slate-900", children: post.title }), _jsx("span", { className: `rounded-full px-2 py-0.5 text-[11px] font-semibold ${post.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`, children: post.status })] }), _jsxs("div", { className: "mt-1 text-xs text-slate-500", children: [post.topic, " \u00B7 ", formatDate(post.publishDate || post.createdDate)] }), _jsx("div", { className: "mt-1 truncate text-xs text-slate-400", children: post.url || blogUrl(post) })] }, post.id))), !filteredPosts.length && _jsx("div", { className: "rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-400", children: "No blog posts match this filter." })] })] }), selected && (_jsxs("div", { className: "border-t border-slate-100 px-5 py-4", children: [_jsx("p", { className: "section-label mt-0", children: "Selected Post" }), _jsx(Field, { label: "Topic", children: _jsx("input", { className: "input", value: selected.topic, onChange: event => updateSelected({ topic: event.target.value, tags: selected.tags, status: selected.status }) }) }), _jsx(Field, { label: "Tags", hint: "comma separated", children: _jsx("input", { className: "input", value: selected.tags.join(', '), onChange: event => updateSelected({ topic: selected.topic, tags: event.target.value.split(',').map(tag => tag.trim()).filter(Boolean), status: selected.status }) }) }), _jsx(Field, { label: "Status", children: _jsxs("select", { className: "input", value: selected.status, onChange: event => updateSelected({ topic: selected.topic, tags: selected.tags, status: event.target.value }), children: [_jsx("option", { value: "published", children: "Published" }), _jsx("option", { value: "draft", children: "Draft" })] }) }), _jsxs("div", { className: "rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-500", children: [_jsxs("div", { children: [_jsx("strong", { children: "Source:" }), " ", selected.originalSourceUrl] }), _jsxs("div", { children: [_jsx("strong", { children: "Canonical:" }), " ", selected.canonicalUrl] }), _jsxs("div", { children: [_jsx("strong", { children: "Images stored:" }), " ", selected.images.length] })] })] }))] }), _jsxs("div", { className: "flex flex-1 flex-col overflow-hidden", children: [_jsx("div", { className: "flex border-b border-slate-200 bg-white px-4", children: ['landing', 'article', 'html'].map(item => (_jsx("button", { onClick: () => setTab(item), className: `-mb-px border-b-2 px-4 py-3 text-sm font-medium capitalize transition ${tab === item ? 'border-brand text-brand' : 'border-transparent text-slate-400 hover:text-slate-700'}`, children: item === 'html' ? 'HTML' : item }, item))) }), tab === 'html' ? (_jsxs("div", { className: "relative flex-1 overflow-auto bg-slate-900 p-4", children: [_jsx("button", { onClick: () => navigator.clipboard.writeText(visibleHtml), className: "absolute right-4 top-4 rounded bg-slate-700 px-3 py-1 text-xs text-slate-300 hover:bg-slate-600", children: "Copy" }), _jsx("pre", { className: "whitespace-pre-wrap font-mono text-xs leading-relaxed text-slate-300", children: visibleHtml || '// Import a blog post first' })] })) : (_jsx("iframe", { title: "blog-preview", srcDoc: `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0">${visibleHtml || '<p style="font-family:sans-serif;color:#94a3b8;padding:24px">Import a blog post to preview.</p>'}</body></html>`, className: "w-full flex-1 border-0 bg-slate-50", sandbox: "allow-same-origin allow-scripts" }))] })] }));
}

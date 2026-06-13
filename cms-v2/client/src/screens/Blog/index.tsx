import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api/client';
import Field from '../../components/Field';
import type { BlogPost, BlogSettings, BlogStatus, FooterData, HeaderConfig } from '../../types/cms';
import { generateBlogArticleHtml, generateBlogLandingHtml, blogUrl } from './generateHtml';
import { generateBlogHeaderHtml } from '../BlogHeader/generateHtml';
import { generateFooterHtml } from '../Footer/generateHtml';
import { wrapGeneratedHtml } from '../../utils/htmlComments';

type ImportResponse = { post: BlogPost; warnings: string[] };

const TOPICS = ['ACCA', 'Accounting', 'Finance', 'Tax', 'Audit', 'Study Tips', 'Exam Preparation', 'Career Advice'];
const API_ORIGIN = (import.meta.env.VITE_API_URL || window.location.origin).replace(/\/api\/?$/, '').replace(/\/$/, '');
const DEFAULT_BLOG_SETTINGS: BlogSettings = { heroGradientColor: '#0d1f3c', tocLinkColor: '#1f73b7' };

function statusClass(type: 'success' | 'error' | 'warning' | 'info'): string {
  return {
    success: 'border-green-200 bg-green-50 text-green-800',
    error: 'border-red-200 bg-red-50 text-red-800',
    warning: 'border-amber-200 bg-amber-50 text-amber-800',
    info: 'border-blue-200 bg-blue-50 text-blue-800',
  }[type];
}

function formatDate(value: string): string {
  if (!value) return 'No date';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-GB');
}

function previewDocument(html: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><base href="${API_ORIGIN}/"></head><body style="margin:0">${html || '<p style="font-family:sans-serif;color:#94a3b8;padding:24px">Import a blog post to preview.</p>'}</body></html>`;
}

function minifyHtml(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/>\s+</g, '><')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function unwrapFooterData(raw: unknown): FooterData | null {
  if (!raw || typeof raw !== 'object') return null;
  const candidate = raw as FooterData & { footer?: FooterData };
  return candidate.footer && typeof candidate.footer === 'object' && !Array.isArray(candidate.footer)
    ? candidate.footer
    : candidate;
}

function combinedCleanupHtml(): string {
  return `<script data-cfasync="false">(function(){function hide(el){if(!el)return;el.style.setProperty('display','none','important');el.style.setProperty('visibility','hidden','important');el.style.setProperty('height','0','important');el.style.setProperty('min-height','0','important');el.style.setProperty('max-height','0','important');el.style.setProperty('margin','0','important');el.style.setProperty('padding','0','important');el.style.setProperty('border','0','important');el.style.setProperty('overflow','hidden','important');}function keep(el){return !!(el.matches&&el.matches('script,style,link,meta,title'))||!!(el.querySelector&&el.querySelector('.vls-blog-header-generated,.vls-blog,.vlsft-generated'))||!!(el.matches&&el.matches('.vls-blog-header-generated,.vls-blog,.vlsft-generated'));}function clean(){document.querySelectorAll('.block.footer-style.parrot.zenstyle.bg-layer.padding-top-50.padding-bottom-50.center-center.footer-block,.footer-block[data-zen="zen_footer_dynamic"],[data-zen="zen_footer_dynamic"]').forEach(function(el){if(!el.querySelector('.vlsft-generated'))hide(el);});var holder=document.querySelector('#zen_blog_post,[data-zd="zen_blog_post"]');if(holder){Array.prototype.slice.call(holder.children).forEach(function(child){if(!keep(child))hide(child);});}}if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',clean);}else{clean();}setTimeout(clean,300);setTimeout(clean,1000);setTimeout(clean,2500);})();<\/script>`;
}

export default function Blog() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [sourceUrl, setSourceUrl] = useState('');
  const [topicOverride, setTopicOverride] = useState('');
  const [slugOverride, setSlugOverride] = useState('');
  const [status, setStatus] = useState<BlogStatus>('published');
  const [importing, setImporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'warning' | 'info'; text: string } | null>(null);
  const [duplicate, setDuplicate] = useState<BlogPost | null>(null);
  const [selectedId, setSelectedId] = useState<string>('');
  const [tab, setTab] = useState<'landing' | 'article' | 'html'>('landing');
  const [htmlTarget, setHtmlTarget] = useState<'article' | 'landing'>('article');
  const [includeChrome, setIncludeChrome] = useState(false);
  const [blogHeaderConfig, setBlogHeaderConfig] = useState<HeaderConfig | null>(null);
  const [footerData, setFooterData] = useState<FooterData | null>(null);
  const [blogSettings, setBlogSettings] = useState<BlogSettings>(DEFAULT_BLOG_SETTINGS);
  const [savingSettings, setSavingSettings] = useState(false);
  const [topicFilter, setTopicFilter] = useState('All');
  const [query, setQuery] = useState('');

  useEffect(() => {
    api.get<BlogPost[]>('/blog/posts')
      .then(data => {
        setPosts(data);
        setSelectedId(data[0]?.id || '');
      })
      .catch(err => setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to load blog posts' }))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    api.get<{ data: { config?: HeaderConfig } }>('/content/vls-blog-header-config')
      .then(row => setBlogHeaderConfig((row?.data as { config?: HeaderConfig })?.config || null))
      .catch(() => setBlogHeaderConfig(null));

    api.get<{ data: FooterData & { footer?: FooterData } }>('/content/vls-footer')
      .then(row => setFooterData(unwrapFooterData(row?.data)))
      .catch(() => setFooterData(null));

    api.get<{ data: Partial<BlogSettings> }>('/content/vls-blog-settings')
      .then(row => setBlogSettings({ ...DEFAULT_BLOG_SETTINGS, ...(row?.data || {}) }))
      .catch(() => setBlogSettings(DEFAULT_BLOG_SETTINGS));
  }, []);

  const selected = posts.find(post => post.id === selectedId) || posts[0] || null;
  const topics = useMemo(() => ['All', ...Array.from(new Set([...TOPICS, ...posts.map(post => post.topic)])).filter(Boolean)], [posts]);
  const filteredPosts = posts.filter(post => {
    const topicOk = topicFilter === 'All' || post.topic === topicFilter;
    const haystack = `${post.title} ${post.summary} ${post.topic} ${post.tags.join(' ')}`.toLowerCase();
    return topicOk && (!query.trim() || haystack.includes(query.toLowerCase()));
  });
  const landingHtml = wrapGeneratedHtml('Blog Landing', generateBlogLandingHtml(posts));
  const articleBodyHtml = selected ? generateBlogArticleHtml(selected, blogSettings) : '';
  const articleHtml = selected ? wrapGeneratedHtml('Blog Article', articleBodyHtml) : '';
  const fullArticleHtml = selected
    ? minifyHtml([
        blogHeaderConfig ? wrapGeneratedHtml('Blog Header', generateBlogHeaderHtml(blogHeaderConfig)) : '',
        wrapGeneratedHtml('Blog Article', articleBodyHtml),
        footerData ? wrapGeneratedHtml('Footer', generateFooterHtml(footerData)) : '',
        combinedCleanupHtml(),
      ].filter(Boolean).join('\n'))
    : '';
  const visibleHtml = tab === 'article' ? articleHtml : tab === 'html' && htmlTarget === 'article' ? articleHtml : landingHtml;
  const copyHtml = tab === 'html' && htmlTarget === 'article' && includeChrome ? fullArticleHtml : visibleHtml;

  async function loadPosts(nextSelectedId?: string) {
    const data = await api.get<BlogPost[]>('/blog/posts');
    setPosts(data);
    setSelectedId(nextSelectedId || data[0]?.id || '');
  }

  async function runImport(force = false) {
    setImporting(true);
    setDuplicate(null);
    setMessage({ type: 'info', text: 'Importing blog post...' });
    try {
      const result = await api.post<ImportResponse>('/blog/import', {
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
    } catch (err) {
      const text = err instanceof Error ? err.message : 'Import failed';
      setMessage({ type: text.toLowerCase().includes('already') || text.toLowerCase().includes('slug') ? 'warning' : 'error', text });
      const maybeDuplicate = err instanceof Error && 'data' in err ? (err as { data?: BlogPost }).data : null;
      if (maybeDuplicate) setDuplicate(maybeDuplicate);
    } finally {
      setImporting(false);
    }
  }

  async function updateSelected(partial: Pick<BlogPost, 'topic' | 'tags' | 'status'>) {
    if (!selected) return;
    const updated = await api.patch<BlogPost>(`/blog/posts/${selected.id}`, partial);
    setPosts(items => items.map(post => post.id === updated.id ? updated : post));
    setSelectedId(updated.id);
    setMessage({ type: 'success', text: 'Blog post updated' });
  }

  async function deleteSelected() {
    if (!selected) return;
    if (!window.confirm(`Delete "${selected.title}" from the blog library?`)) return;
    setDeleting(true);
    try {
      await api.delete<{ id: string }>(`/blog/posts/${selected.id}`);
      const remaining = posts.filter(post => post.id !== selected.id);
      setPosts(remaining);
      setSelectedId(remaining[0]?.id || '');
      setTab(remaining.length ? 'landing' : 'html');
      setMessage({ type: 'success', text: 'Blog post deleted' });
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Delete failed' });
    } finally {
      setDeleting(false);
    }
  }

  async function saveBlogSettings() {
    setSavingSettings(true);
    try {
      const settings = {
        ...blogSettings,
        heroGradientColor: /^#[0-9a-fA-F]{6}$/.test(blogSettings.heroGradientColor) ? blogSettings.heroGradientColor : DEFAULT_BLOG_SETTINGS.heroGradientColor,
        tocLinkColor: /^#[0-9a-fA-F]{6}$/.test(blogSettings.tocLinkColor) ? blogSettings.tocLinkColor : DEFAULT_BLOG_SETTINGS.tocLinkColor,
      };
      await api.put('/content/vls-blog-settings', settings);
      setBlogSettings(settings);
      setMessage({ type: 'success', text: 'Blog hero settings saved' });
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save blog settings' });
    } finally {
      setSavingSettings(false);
    }
  }

  if (loading) return <div className="flex h-full items-center justify-center text-sm text-slate-400">Loading blog posts...</div>;

  return (
    <div className="flex h-full">
      <div className="w-[500px] shrink-0 overflow-y-auto border-r border-slate-200 bg-white">
        <div className="sticky top-0 z-10 border-b border-slate-100 bg-white px-5 py-4">
          <h1 className="text-base font-bold text-slate-900">Blog Import</h1>
          <p className="mt-0.5 text-xs text-slate-400">Scrape, store and publish VLS blog posts</p>
        </div>

        <div className="border-b border-slate-100 px-5 py-4">
          <p className="section-label mt-0">Import Blog URL</p>
          <Field label="Source URL">
            <input className="input" value={sourceUrl} placeholder="https://blog.vls-online.com/post/..." onChange={event => setSourceUrl(event.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Topic override">
              <select className="input" value={topicOverride} onChange={event => setTopicOverride(event.target.value)}>
                <option value="">Auto detect</option>
                {TOPICS.map(topic => <option key={topic} value={topic}>{topic}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select className="input" value={status} onChange={event => setStatus(event.target.value as BlogStatus)}>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
              </select>
            </Field>
          </div>
          <Field label="Slug override" hint="optional">
            <input className="input" value={slugOverride} placeholder="afm-common-mistakes-guide-2026" onChange={event => setSlugOverride(event.target.value)} />
          </Field>
          <div className="flex gap-2">
            <button disabled={importing || !sourceUrl.trim()} className="btn-primary flex-1 justify-center" onClick={() => runImport(false)}>
              {importing ? 'Importing...' : 'Import'}
            </button>
            {duplicate && (
              <button disabled={importing} className="btn-success justify-center" onClick={() => runImport(true)}>
                Update existing
              </button>
            )}
          </div>
          {message && <div className={`mt-3 rounded-lg border p-3 text-xs leading-relaxed ${statusClass(message.type)}`}>{message.text}</div>}
          {duplicate && <div className="mt-2 text-xs text-slate-500">Duplicate: {duplicate.title} ({duplicate.url || blogUrl(duplicate)})</div>}
        </div>

        <div className="border-b border-slate-100 px-5 py-4">
          <p className="section-label mt-0">Global Blog Hero</p>
          <Field label="Gradient overlay colour" hint="applies to all blog article banners">
            <div className="flex gap-2">
              <input
                type="color"
                value={/^#[0-9a-fA-F]{6}$/.test(blogSettings.heroGradientColor) ? blogSettings.heroGradientColor : DEFAULT_BLOG_SETTINGS.heroGradientColor}
                onChange={event => setBlogSettings(settings => ({ ...settings, heroGradientColor: event.target.value }))}
                className="h-10 w-12 shrink-0 cursor-pointer rounded border border-slate-200 p-1"
              />
              <input
                className="input"
                value={blogSettings.heroGradientColor}
                onChange={event => setBlogSettings(settings => ({ ...settings, heroGradientColor: event.target.value }))}
                placeholder="#0d1f3c"
              />
            </div>
          </Field>
          <Field label="Table of Contents link colour" hint="applies to all blog article TOC links">
            <div className="flex gap-2">
              <input
                type="color"
                value={/^#[0-9a-fA-F]{6}$/.test(blogSettings.tocLinkColor) ? blogSettings.tocLinkColor : DEFAULT_BLOG_SETTINGS.tocLinkColor}
                onChange={event => setBlogSettings(settings => ({ ...settings, tocLinkColor: event.target.value }))}
                className="h-10 w-12 shrink-0 cursor-pointer rounded border border-slate-200 p-1"
              />
              <input
                className="input"
                value={blogSettings.tocLinkColor}
                onChange={event => setBlogSettings(settings => ({ ...settings, tocLinkColor: event.target.value }))}
                placeholder="#1f73b7"
              />
            </div>
          </Field>
          <button disabled={savingSettings} className="btn-success w-full justify-center py-2 text-sm" onClick={saveBlogSettings}>
            {savingSettings ? 'Saving...' : 'Save blog hero settings'}
          </button>
        </div>

        <div className="px-5 py-4">
          <p className="section-label mt-0">Blog Library</p>
          <div className="mb-3 grid grid-cols-[1fr_130px] gap-2">
            <input className="input" value={query} placeholder="Search saved posts" onChange={event => setQuery(event.target.value)} />
            <select className="input" value={topicFilter} onChange={event => setTopicFilter(event.target.value)}>
              {topics.map(topic => <option key={topic} value={topic}>{topic}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            {filteredPosts.map(post => (
              <button
                key={post.id}
                className={`w-full rounded-lg border p-3 text-left transition ${selected?.id === post.id ? 'border-brand bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                onClick={() => {
                  setSelectedId(post.id);
                  setTab('article');
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <strong className="text-sm text-slate-900">{post.title}</strong>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${post.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>{post.status}</span>
                </div>
                <div className="mt-1 text-xs text-slate-500">{post.topic} · {formatDate(post.publishDate || post.createdDate)}</div>
                <div className="mt-1 truncate text-xs text-slate-400">{post.url || blogUrl(post)}</div>
              </button>
            ))}
            {!filteredPosts.length && <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-400">No blog posts match this filter.</div>}
          </div>
        </div>

        {selected && (
          <div className="border-t border-slate-100 px-5 py-4">
            <p className="section-label mt-0">Selected Post</p>
            <Field label="Topic">
              <input className="input" value={selected.topic} onChange={event => updateSelected({ topic: event.target.value, tags: selected.tags, status: selected.status })} />
            </Field>
            <Field label="Tags" hint="comma separated">
              <input className="input" value={selected.tags.join(', ')} onChange={event => updateSelected({ topic: selected.topic, tags: event.target.value.split(',').map(tag => tag.trim()).filter(Boolean), status: selected.status })} />
            </Field>
            <Field label="Status">
              <select className="input" value={selected.status} onChange={event => updateSelected({ topic: selected.topic, tags: selected.tags, status: event.target.value as BlogStatus })}>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
              </select>
            </Field>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-500">
              <div><strong>Source:</strong> {selected.originalSourceUrl}</div>
              <div><strong>Canonical:</strong> {selected.canonicalUrl}</div>
              <div><strong>Images stored:</strong> {selected.images.length}</div>
            </div>
            <button className="btn-danger mt-3 w-full justify-center border border-red-100 py-2 text-sm" disabled={deleting} onClick={deleteSelected}>
              {deleting ? 'Deleting...' : 'Delete blog post'}
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex border-b border-slate-200 bg-white px-4">
          {(['landing', 'article', 'html'] as const).map(item => (
            <button
              key={item}
              onClick={() => {
                setTab(item);
                if (item === 'article') setHtmlTarget('article');
                if (item === 'landing') setHtmlTarget('landing');
              }}
              className={`-mb-px border-b-2 px-4 py-3 text-sm font-medium capitalize transition ${tab === item ? 'border-brand text-brand' : 'border-transparent text-slate-400 hover:text-slate-700'}`}
            >
              {item === 'html' ? 'HTML' : item}
            </button>
          ))}
        </div>
        {tab === 'html' ? (
          <div className="relative flex-1 overflow-auto bg-slate-900 p-4">
            <div className="absolute right-4 top-4 flex flex-wrap items-center justify-end gap-2">
              {htmlTarget === 'article' && (
                <label className="flex items-center gap-2 rounded bg-slate-800 px-3 py-1 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={includeChrome}
                    onChange={event => setIncludeChrome(event.target.checked)}
                  />
                  Include header and footer
                </label>
              )}
              <button onClick={() => setHtmlTarget('article')} disabled={!selected} className={`rounded px-3 py-1 text-xs ${htmlTarget === 'article' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>Article HTML</button>
              <button onClick={() => setHtmlTarget('landing')} className={`rounded px-3 py-1 text-xs ${htmlTarget === 'landing' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>Landing HTML</button>
              <button onClick={() => navigator.clipboard.writeText(copyHtml)} className="rounded bg-slate-700 px-3 py-1 text-xs text-slate-300 hover:bg-slate-600">Copy</button>
            </div>
            <pre className="whitespace-pre-wrap pt-12 font-mono text-xs leading-relaxed text-slate-300">{copyHtml || '// Import a blog post first'}</pre>
          </div>
        ) : (
          <iframe
            title="blog-preview"
            srcDoc={previewDocument(visibleHtml)}
            className="w-full flex-1 border-0 bg-slate-50"
            sandbox="allow-same-origin allow-scripts"
          />
        )}
      </div>
    </div>
  );
}

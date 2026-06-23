import type { BlogPost, BlogSettings } from '../../types/cms';
import { escapeHtml } from '../../utils/text';

const ASSET_ORIGIN = (import.meta.env.VITE_API_URL || window.location.origin).replace(/\/api\/?$/, '').replace(/\/$/, '');

function attr(value: string): string {
  return escapeHtml(value || '').replace(/"/g, '&quot;');
}

function absoluteAssetUrl(value: string): string {
  if (!value) return '';
  if (/^https?:\/\//i.test(value) || value.startsWith('data:')) return value;
  if (value.startsWith('/blog-assets/')) return `${ASSET_ORIGIN}${value}`;
  return value;
}

function isScreenshotImageUrl(value: string): boolean {
  return /\/screenshots?\//i.test(value || '');
}

function featuredImage(post: BlogPost): string {
  if (post.featuredImagePath) return absoluteAssetUrl(post.featuredImagePath);
  const fallback = post.images?.find(image => image.localPath && !isScreenshotImageUrl(image.sourceUrl));
  return fallback ? absoluteAssetUrl(fallback.localPath) : '';
}

function getRandomRelatedPosts(currentPost: BlogPost, allPosts: BlogPost[], count = 3): BlogPost[] {
  const published = allPosts.filter(
    post => post.status === 'published' && post.id !== currentPost.id
  );

  if (published.length <= count) return published;

  const currentTags = currentPost.tags || [];
  const scored = published.map(post => {
    let score = 0;

    if (post.topic === currentPost.topic) score += 10;
    const sharedTags = (post.tags || []).filter(tag => currentTags.includes(tag)).length;
    score += sharedTags * 5;

    return { post, score };
  });

  const related = scored.filter(item => item.score > 0);
  const pool = related.length >= count ? related : scored;
  const candidates = pool
    .sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      return Math.random() - 0.5;
    })
    .slice(0, Math.min(count * 3, pool.length));
  const selected: BlogPost[] = [];

  for (let i = 0; i < count && candidates.length > 0; i += 1) {
    const idx = Math.floor(Math.random() * candidates.length);
    selected.push(candidates[idx].post);
    candidates.splice(idx, 1);
  }

  return selected;
}

function safeHex(value: string | undefined, fallback = '#0d1f3c'): string {
  return /^#[0-9a-fA-F]{6}$/.test(String(value || '').trim()) ? String(value).trim() : fallback;
}

function heroBackground(image: string, color: string): string {
  const overlay = `linear-gradient(90deg, ${color}fa 0%, ${color}e8 42%, ${color}c0 100%)`;
  return image ? `${overlay}, url('${attr(image)}')` : `linear-gradient(135deg, ${color} 0%, #14345f 100%)`;
}

function bodyWithAbsoluteAssets(html: string, articleUrl: string): string {
  const withAssets = html
    .replace(/(<img\b[^>]*\ssrc=["'])(\/blog-assets\/[^"']+)(["'][^>]*>)/gi, (_match, start: string, src: string, end: string) => {
      return `${start}${absoluteAssetUrl(src)}${end}`;
    })
    .replace(/(<a\b[^>]*\shref=["'])(?:https?:\/\/(?:blog\.)?vls-online\.com)?\/post\/([^"'?#/]+)[^"']*(["'][^>]*>)/gi, (_match, start: string, slug: string, end: string) => {
      return `${start}https://vls-online.com/blog/${slug}/${end}`;
    });

  return withAssets.replace(/(<a\b[^>]*\shref=["'])([^"']+)(["'][^>]*>)/gi, (_match, start: string, href: string, end: string) => {
    if (href.startsWith('#')) return `${start}${href}${end}`;
    try {
      const parsed = new URL(href, articleUrl);
      const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();
      if (host === 'getautoseo.com') return `${start}${articleUrl}${end}`;
      if (host === 'vls-online.com' || host === 'blog.vls-online.com') {
        return `${start}https://vls-online.com${parsed.pathname}${parsed.search}${parsed.hash}${end}`;
      }
      return `${start}${href}${end}`;
    } catch {
      if (href.startsWith('/')) return `${start}https://vls-online.com${href}${end}`;
      return `${start}${href}${end}`;
    }
  });
}

function normalizeText(value: string): string {
  return (value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function normalizeLookupText(value: string): string {
  return normalizeText(value)
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripLeadingDuplicateTitle(html: string, title: string): string {
  const titleText = normalizeText(title);
  if (!titleText) return html || '';
  return (html || '').replace(/^(\s|<!--[\s\S]*?-->)*(<h[1-2]\b[^>]*>[\s\S]*?<\/h[1-2]>)/i, (match, _prefix: string, heading: string) => {
    return normalizeText(heading) === titleText ? '' : match;
  });
}

function stripImportedSourceHero(html: string, title: string): string {
  return stripLeadingDuplicateTitle(html, title).trimStart();
}

function stripAutoSeoPromo(html: string): string {
  let next = html || '';
  for (let i = 0; i < 4; i += 1) {
    const previous = next;
    next = next
      .replace(/<h[2-4]\b[^>]*>\s*Want to create content like this\?\s*<\/h[2-4]>\s*(?:<p\b[^>]*>[\s\S]*?<\/p>\s*)?(?:<p\b[^>]*>\s*<a\b[\s\S]*?Get Started Free[\s\S]*?<\/a>\s*<\/p>\s*)?/gi, '')
      .replace(/<p\b[^>]*>\s*AutoSEO helps you[\s\S]*?<\/p>/gi, '')
      .replace(/<p\b[^>]*>\s*This article was shared from AutoSEO[\s\S]*?<\/p>/gi, '')
      .replace(/<p\b[^>]*>\s*Powered by AutoSEO[\s\S]*?<\/p>/gi, '')
      .replace(/<p\b[^>]*>\s*<a\b[\s\S]*?Get Started Free[\s\S]*?<\/a>\s*<\/p>/gi, '')
      .replace(/<a\b[^>]*>\s*Get Started Free\s*<\/a>/gi, '')
      .replace(/<(?:button|span)\b[^>]*>\s*Get Started Free\s*<\/(?:button|span)>/gi, '');
    if (next === previous) break;
  }
  return next;
}

function headingId(text: string, index: number): string {
  const slug = normalizeText(text).replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return slug || `section-${index + 1}`;
}

function addHeadingIdsAndTocLinks(html: string): string {
  const headingIds = new Map<string, string>();
  const looseHeadingIds = new Map<string, string>();
  const used = new Map<string, number>();
  const headingOrder: string[] = [];
  let count = 0;
  let next = html.replace(/<h([2-4])\b([^>]*)>([\s\S]*?)<\/h\1>/gi, (match, level: string, attrs: string, inner: string) => {
    const text = normalizeText(inner);
    if (!text || text === 'table of contents') return match;
    const base = headingId(inner, count);
    const seen = used.get(base) || 0;
    used.set(base, seen + 1);
    const id = seen ? `${base}-${seen + 1}` : base;
    headingIds.set(text, id);
    const lookupText = normalizeLookupText(inner);
    if (lookupText) looseHeadingIds.set(lookupText, id);
    headingOrder.push(id);
    count += 1;
    const cleanAttrs = attrs.replace(/\s+id=(["']).*?\1/i, '').trim();
    return `<h${level}${cleanAttrs ? ` ${cleanAttrs}` : ''} id="${attr(id)}">${inner}</h${level}>`;
  });

  next = next.replace(/(<h[2-4]\b[^>]*>\s*(?:<a\b[^>]*>\s*<\/a>\s*)?Table of Contents\s*<\/h[2-4]>\s*<ul>)([\s\S]*?)(<\/ul>)/i, (_match, start: string, items: string, end: string) => {
    const tocStart = /\bclass=/.test(start)
      ? start.replace(/(<ul\b[^>]*class=["'])([^"']*)(["'])/i, '$1$2 toc$3')
      : start.replace(/<ul\b/i, '<ul class="toc"');
    let itemIndex = 0;
    const linked = items.replace(/<li>\s*([\s\S]*?)\s*<\/li>/gi, (_item, label: string) => {
      const match = label.match(/<a\b[^>]*>([\s\S]*?)<\/a>/i);
      const labelText = normalizeText(match ? match[1] : label);
      const lookupText = normalizeLookupText(match ? match[1] : label);
      if (!labelText || labelText === 'table of contents') return '';
      const id = headingIds.get(labelText)
        || looseHeadingIds.get(lookupText)
        || Array.from(looseHeadingIds.entries()).find(([key]) => key.includes(lookupText) || lookupText.includes(key))?.[1]
        || headingOrder[itemIndex]
        || headingId(match ? match[1] : label, itemIndex);
      itemIndex += 1;
      return `<li><a href="#${attr(id)}">${escapeHtml(stripTags(match ? match[1] : label))}</a></li>`;
    });
    return `${tocStart}${linked}${end}`;
  });

  return next;
}

function stripTags(value: string): string {
  return (value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeRelatedCards(anchors: string): string {
  return anchors.replace(/(<a\b[^>]*>)([\s\S]*?)(<\/a>)/gi, (match, start: string, inner: string, end: string) => {
    if (/\b(?:vls-blog-related-meta|related-meta)\b/.test(inner)) return match;
    const next = inner.replace(/(<\/h3>\s*)([^<]+)\s*$/i, (_metaMatch, headingEnd: string, meta: string) => {
      const text = meta.replace(/\s+/g, ' ').trim();
      return text ? `${headingEnd}<span class="vls-blog-related-meta">${escapeHtml(text)}</span>` : headingEnd;
    });
    return `${start}${next}${end}`;
  });
}

function wrapRelatedArticles(html: string): string {
  return html.replace(/<h2\b[^>]*>\s*More Articles\s*<\/h2>\s*((?:\s*<a\b[\s\S]*?<\/a>\s*)+)/i, (_match, anchors: string) => {
    return `<section class="vls-blog-related"><h2>More Articles</h2><div class="vls-blog-related-grid">${normalizeRelatedCards(anchors)}</div></section>`;
  });
}

function stripImportedRelatedArticles(html: string): string {
  let next = html || '';
  for (let i = 0; i < 4; i += 1) {
    const previous = next;
    next = next
      .replace(/<section\b[^>]*\bclass=["'][^"']*(?:vls-blog-related|related)[^"']*["'][^>]*>[\s\S]*?<\/section>/gi, '')
      .replace(/<h2\b[^>]*>\s*More Articles\s*<\/h2>\s*<div\b[^>]*\bclass=["'][^"']*(?:vls-blog-related-grid|related-grid)[^"']*["'][^>]*>[\s\S]*?<\/div>/gi, '')
      .replace(/<h2\b[^>]*>\s*More Articles\s*<\/h2>\s*(?:\s*<a\b[\s\S]*?<\/a>\s*)+/gi, '');
    if (next === previous) break;
  }
  return next;
}

function renderRelatedArticles(posts: BlogPost[]): string {
  if (!posts || posts.length === 0) return '';

  const cards = posts.map(post => {
    const image = featuredImage(post);
    return `<a href="${attr(blogUrl(post))}" class="vls-blog-related-card">
    ${image ? `<img src="${attr(image)}" alt="${attr(post.title)}" loading="lazy">` : ''}
    <h3>${escapeHtml(post.title)}</h3>
    <span class="vls-blog-related-meta">${escapeHtml(formatDate(post.publishDate || ''))}</span>
  </a>`;
  }).join('');

  return `<section class="vls-blog-related vls-blog-related-suggestions"><h2>More Articles</h2><div class="vls-blog-related-grid">${cards}</div></section>`;
}

function prepareArticleBody(html: string, title: string): string {
  return stripImportedRelatedArticles(wrapRelatedArticles(addHeadingIdsAndTocLinks(stripAutoSeoPromo(stripImportedSourceHero(html, title)))));
}

function shareLinks(post: BlogPost): string {
  const url = blogUrl(post);
  const title = post.title || 'VLS Learning Blog';
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);
  return `<div class="vls-blog-share" aria-label="Share this article">
    <strong>Share</strong>
    <div class="vls-blog-share-links">
      <a href="https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}" target="_blank" rel="noopener" aria-label="Share on Facebook">f</a>
      <a href="https://www.linkedin.com/shareArticle?mini=true&url=${encodedUrl}&title=${encodedTitle}" target="_blank" rel="noopener" aria-label="Share on LinkedIn">in</a>
      <a href="https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}" target="_blank" rel="noopener" aria-label="Share on X">X</a>
    </div>
  </div>`;
}

function topicSlug(topic: string): string {
  return (topic || 'blog').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'blog';
}

export function blogUrl(post: BlogPost): string {
  return `/blog/${topicSlug(post.topic)}/${post.slug}`;
}

function absoluteBlogUrl(post: BlogPost): string {
  return `https://vls-online.com${blogUrl(post)}`;
}

function formatDate(value: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function articleSchema(post: BlogPost): string {
  const image = featuredImage(post);
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.metaDescription || post.summary,
    image: image ? [image] : undefined,
    author: post.author ? { '@type': 'Person', name: post.author } : undefined,
    datePublished: post.publishDate || post.createdDate,
    dateModified: post.updatedDate,
    mainEntityOfPage: absoluteBlogUrl(post),
  };
  return `<script type="application/ld+json">${JSON.stringify(schema).replace(/</g, '\\u003c')}<\/script>`;
}

const baseCss = `<style>
.vls-blog{font-family:Poppins,Arial,sans-serif;color:#0d1f3c;background:#f5f8fc;margin-top:34px;scroll-behavior:smooth;}
.vls-blog *{box-sizing:border-box;}
.vls-blog a{color:#1f73b7;text-decoration:none;font-weight:700;}
.vls-blog-shell{max-width:1160px;margin:0 auto;padding:46px 24px;}
.vls-blog-kicker{display:inline-flex;align-items:center;border-radius:999px;background:#e8f3fc;color:#1f73b7;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;padding:7px 12px;}
.vls-blog-hero-banner{background-color:#0d1f3c;background-size:cover;background-position:center;background-repeat:no-repeat;min-height:390px;display:flex;align-items:end;position:relative;overflow:hidden;}
.vls-blog-hero-banner .vls-blog-shell{width:100%;padding-top:86px;padding-bottom:70px;}
.vls-blog-hero-banner .vls-blog-kicker{background:#14345f!important;color:#ffffff!important;border:1px solid rgba(255,255,255,.28)!important;}
html body .vls-blog .vls-blog-hero-banner h1{font-size:clamp(34px,5vw,58px);line-height:1.05;margin:18px 0 14px;letter-spacing:0;color:#fff!important;-webkit-text-fill-color:#fff!important;max-width:920px;text-shadow:0 2px 18px rgba(0,0,0,.22);}
.vls-blog h2{font-size:28px;line-height:1.2;margin:34px 0 12px;color:#0d1f3c;}
.vls-blog h3{font-size:22px;line-height:1.3;margin:28px 0 10px;color:#14345f;}
.vls-blog p,.vls-blog li{font-size:16px;line-height:1.75;color:#42526b;}
.vls-blog>.vls-blog-shell>p{color:#dbeafe;}
.vls-blog-meta{display:flex;flex-wrap:wrap;gap:10px;color:#dbeafe;font-size:13px;margin:0 0 24px;}
.vls-blog-card .vls-blog-meta,.vls-blog-side .vls-blog-meta{color:#667085;}
.vls-blog-article .toc a{color:var(--toc-link-color,#1f73b7)!important;}
.vls-blog-layout{display:grid;grid-template-columns:minmax(0,1fr) 260px;gap:34px;align-items:start;}
.vls-blog-article{background:#fff;border:1px solid #e1e8f1;border-radius:8px;padding:38px;box-shadow:0 18px 45px rgba(13,31,60,.08);}
.vls-blog-article img{display:block;width:100%;height:auto;border-radius:8px;margin:24px 0;border:1px solid #e1e8f1;}
.vls-blog-article table{width:100%;border-collapse:collapse;margin:24px 0;font-size:14px;}
.vls-blog-article th,.vls-blog-article td{border:1px solid #dbe5f1;padding:10px;text-align:left;vertical-align:top;}
.vls-blog-article th{background:#f1f6fc;color:#0d1f3c;}
.vls-blog-related,.related{margin-top:34px;}
.vls-blog-related h2,.related h2{margin-top:0;}
.vls-blog-related-grid,.related-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;}
.vls-blog-related-grid>a,.related-grid>a{display:flex;flex-direction:column;min-width:0;background:#fff;border:1px solid #e1e8f1;border-radius:8px;overflow:hidden;box-shadow:0 10px 24px rgba(13,31,60,.06);color:#667085!important;font-size:12px;font-weight:500;line-height:1.5;text-decoration:none;}
.vls-blog-related-grid>a img,.related-grid>a img{width:100%;height:112px;object-fit:cover;border:0;border-radius:0;margin:0;background:#dbe5f1;}
.vls-blog-related-grid>a h3,.related-grid>a h3{font-size:15px;line-height:1.35;margin:12px 14px 6px;color:#0d1f3c;}
.vls-blog-related-grid>a>:not(img):not(h3),.related-grid>a>:not(img):not(h3),.vls-blog-related-meta,.related-meta{display:block;margin:0 14px 14px;}
.vls-blog-side{position:sticky;top:24px;background:#fff;border:1px solid #e1e8f1;border-radius:8px;padding:18px;box-shadow:0 12px 30px rgba(13,31,60,.06);}
.vls-blog-tags{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;}
.vls-blog-tag{border-radius:999px;background:#f1f6fc;color:#24466f;padding:6px 10px;font-size:12px;font-weight:700;}
.vls-blog-share{margin-bottom:20px;}
.vls-blog-share strong{display:block;margin-bottom:10px;color:#0d1f3c;}
.vls-blog-share-links{display:flex;gap:8px;}
.vls-blog-share-links a{display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:8px;background:#f1f6fc;color:#0d1f3c;text-decoration:none;font-size:13px;font-weight:800;}
.vls-blog-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;margin-top:24px;}
.vls-blog-card{display:flex;flex-direction:column;background:#fff;border:1px solid #e1e8f1;border-radius:8px;overflow:hidden;min-height:100%;box-shadow:0 14px 34px rgba(13,31,60,.07);}
.vls-blog-card img{width:100%;height:180px;object-fit:cover;background:#dbe5f1;}
.vls-blog-card-body{padding:18px;display:flex;flex-direction:column;gap:10px;flex:1;}
.vls-blog-card h2{font-size:18px;line-height:1.3;margin:0;}
.vls-blog-card p{font-size:14px;line-height:1.6;margin:0;}
.vls-blog-toolbar{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-top:24px;}
.vls-blog-filter,.vls-blog-search{border:1px solid #d6e0eb;background:#fff;border-radius:999px;padding:9px 14px;font:600 13px Poppins,Arial,sans-serif;color:#334155;}
.vls-blog-filter.is-active{background:#1f73b7;color:#fff;border-color:#1f73b7;}
.vls-blog-search{margin-left:auto;min-width:260px;border-radius:8px;font-weight:500;}
.vls-blog-pagination{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:8px;margin-top:28px;}
.vls-blog-page-btn{border:1px solid #d6e0eb;background:#fff;border-radius:8px;padding:8px 12px;font:700 13px Poppins,Arial,sans-serif;color:#24466f;cursor:pointer;}
.vls-blog-page-btn.is-active{background:#1f73b7;border-color:#1f73b7;color:#fff;}
.vls-blog-page-btn:disabled{opacity:.45;cursor:not-allowed;}
.vls-blog-page-status{font-size:13px;color:#64748b;margin-left:8px;}
@media(max-width:900px){.vls-blog-layout{grid-template-columns:1fr}.vls-blog-side{position:static}.vls-blog-grid{grid-template-columns:1fr 1fr}.vls-blog-article{padding:24px}.vls-blog-search{margin-left:0;width:100%;}}
@media(max-width:720px){.vls-blog-related-grid,.related-grid{grid-template-columns:1fr}.vls-blog-related-grid>a img,.related-grid>a img{height:150px;}}
@media(max-width:620px){.vls-blog{margin-top:28px}.vls-blog-shell{padding:28px 16px}.vls-blog-grid{grid-template-columns:1fr}.vls-blog-hero-banner{min-height:340px}.vls-blog-hero-banner .vls-blog-shell{padding-top:58px;padding-bottom:48px}.vls-blog h1{font-size:34px}.vls-blog-article{padding:18px}}
</style>`;

export function generateBlogArticleHtml(post: BlogPost, settings: Partial<BlogSettings> = {}, allPosts: BlogPost[] = []): string {
  const metaDescription = post.metaDescription || post.summary;
  const image = featuredImage(post);
  const gradientColor = safeHex(settings.heroGradientColor);
  const tocLinkColor = safeHex(settings.tocLinkColor, '#1f73b7');
  const background = heroBackground(image, gradientColor);
  const tags = post.tags.map(tag => `<span class="vls-blog-tag">${escapeHtml(tag)}</span>`).join('');
  const bodyHtml = prepareArticleBody(bodyWithAbsoluteAssets(post.bodyHtml, absoluteBlogUrl(post)), post.title);
  const relatedArticles = allPosts.length > 0 ? getRandomRelatedPosts(post, allPosts, 3) : [];
  const relatedHtml = relatedArticles.length > 0 ? renderRelatedArticles(relatedArticles) : '';
  return `<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<title>${escapeHtml(post.metaTitle || post.title)}</title>
<meta name="description" content="${attr(metaDescription)}">
<link rel="canonical" href="${attr(absoluteBlogUrl(post))}">
<meta property="og:title" content="${attr(post.metaTitle || post.title)}">
<meta property="og:description" content="${attr(metaDescription)}">
${image ? `<meta property="og:image" content="${attr(image)}">` : ''}
${baseCss}
<main class="vls-blog">
  <section class="vls-blog-hero-banner" style="background-image:${attr(background)}">
    <div class="vls-blog-shell">
      <a class="vls-blog-kicker" href="/blog">See all blogs</a>
      <h1 style="color:#ffffff!important;-webkit-text-fill-color:#ffffff!important;">${escapeHtml(post.title)}</h1>
      <div class="vls-blog-meta">${post.publishDate ? `<span>${escapeHtml(formatDate(post.publishDate))}</span>` : ''}</div>
    </div>
  </section>
  <div class="vls-blog-shell" style="--toc-link-color:${attr(tocLinkColor)}">
    <div class="vls-blog-layout">
      <article class="vls-blog-article">${bodyHtml}${relatedHtml}</article>
      <aside class="vls-blog-side">
        ${shareLinks(post)}
        <strong>Topic</strong>
        <div class="vls-blog-tags"><span class="vls-blog-tag">${escapeHtml(post.topic)}</span></div>
        ${tags ? `<strong style="display:block;margin-top:18px">Tags</strong><div class="vls-blog-tags">${tags}</div>` : ''}
      </aside>
    </div>
  </div>
</main>
${articleSchema(post)}`;
}

export function generateBlogLandingHtml(posts: BlogPost[]): string {
  const published = posts.filter(post => post.status === 'published');
  const topics = ['All', ...Array.from(new Set(published.map(post => post.topic))).sort()];
  const filters = topics.map(topic => `<button type="button" class="vls-blog-filter${topic === 'All' ? ' is-active' : ''}" data-topic="${attr(topic)}">${escapeHtml(topic)}</button>`).join('');
  const cards = published.map(post => `<article class="vls-blog-card" data-topic="${attr(post.topic)}" data-search="${attr(`${post.title} ${post.summary} ${post.topic} ${post.tags.join(' ')}`.toLowerCase())}">
    ${featuredImage(post) ? `<img src="${attr(featuredImage(post))}" alt="${attr(post.title)}">` : ''}
    <div class="vls-blog-card-body">
      <span class="vls-blog-kicker">${escapeHtml(post.topic)}</span>
      <h2>${escapeHtml(post.title)}</h2>
      <div class="vls-blog-meta">${post.publishDate ? `<span>${escapeHtml(formatDate(post.publishDate))}</span>` : ''}</div>
      <p>${escapeHtml(post.summary)}</p>
      <a href="${attr(blogUrl(post))}">Read more</a>
    </div>
  </article>`).join('');
  return `<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<title>VLS Learning Blog</title>
<meta name="description" content="ACCA, accounting, finance and career guidance from VLS Online tutors and learning specialists.">
${baseCss}
<main class="vls-blog">
  <div class="vls-blog-shell">
    <span class="vls-blog-kicker">VLS Online</span>
    <h1 style="color:#ffffff!important;-webkit-text-fill-color:#ffffff!important;">VLS Learning Blog</h1>
    <p style="max-width:760px">Practical guidance for ACCA learners, finance professionals and ambitious students preparing for exams, career moves and technical accounting challenges.</p>
    <div class="vls-blog-toolbar">${filters}<input class="vls-blog-search" type="search" placeholder="Search blog posts" aria-label="Search blog posts"></div>
    <section class="vls-blog-grid">${cards || '<p>No published blog posts yet.</p>'}</section>
    <nav class="vls-blog-pagination" aria-label="Blog pagination"></nav>
  </div>
</main>
<script>(function(){var root=document.currentScript.previousElementSibling;var topic='All';var search='';var page=1;var perPage=9;var pager=root.querySelector('.vls-blog-pagination');function matches(card){var topicOk=topic==='All'||card.getAttribute('data-topic')===topic;var searchOk=!search||String(card.getAttribute('data-search')||'').indexOf(search)>-1;return topicOk&&searchOk;}function button(label,target,active,disabled){return '<button type="button" class="vls-blog-page-btn'+(active?' is-active':'')+'" data-page="'+target+'"'+(disabled?' disabled':'')+'>'+label+'</button>';}function renderPager(totalPages,total){if(!pager)return; if(totalPages<=1){pager.innerHTML='';return;}var html=button('Prev',Math.max(1,page-1),false,page===1);for(var i=1;i<=totalPages;i++){html+=button(String(i),i,i===page,false);}html+=button('Next',Math.min(totalPages,page+1),false,page===totalPages);html+='<span class="vls-blog-page-status">'+total+' posts</span>';pager.innerHTML=html;}function apply(){root.querySelectorAll('.vls-blog-filter').forEach(function(btn){btn.classList.toggle('is-active',btn.getAttribute('data-topic')===topic);});var cards=Array.prototype.slice.call(root.querySelectorAll('.vls-blog-card'));var matched=cards.filter(matches);var totalPages=Math.max(1,Math.ceil(matched.length/perPage));if(page>totalPages)page=totalPages;cards.forEach(function(card){card.hidden=true;});matched.forEach(function(card,index){card.hidden=index<(page-1)*perPage||index>=page*perPage;});renderPager(totalPages,matched.length);}root.addEventListener('click',function(event){var filter=event.target.closest('.vls-blog-filter');if(filter){topic=filter.getAttribute('data-topic')||'All';page=1;apply();return;}var pageBtn=event.target.closest('.vls-blog-page-btn[data-page]');if(pageBtn&&!pageBtn.disabled){page=Number(pageBtn.getAttribute('data-page'))||1;apply();}});var input=root.querySelector('.vls-blog-search');if(input)input.addEventListener('input',function(){search=String(input.value||'').toLowerCase();page=1;apply();});apply();})();<\/script>`;
}

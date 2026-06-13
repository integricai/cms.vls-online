import type { BlogPost } from '../models/blog';
import { slugify } from './blogImport';

export interface BlogSettings {
  heroGradientColor?: string;
}

function escapeHtml(value: string): string {
  return (value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function attr(value: string): string {
  return escapeHtml(value).replace(/"/g, '&quot;');
}

function rewriteArticleLinks(html: string): string {
  return html.replace(/(<a\b[^>]*\shref=["'])(?:https?:\/\/(?:blog\.)?vls-online\.com)?\/post\/([^"'?#/]+)[^"']*(["'][^>]*>)/gi, (_match, start: string, slug: string, end: string) => {
    return `${start}/blog/${slug}/${end}`;
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

function stripLeadingDuplicateTitle(html: string, title: string): string {
  const titleText = normalizeText(title);
  if (!titleText) return html || '';
  return (html || '').replace(/^(\s|<!--[\s\S]*?-->)*(<h[1-2]\b[^>]*>[\s\S]*?<\/h[1-2]>)/i, (match, _prefix: string, heading: string) => {
    return normalizeText(heading) === titleText ? '' : match;
  });
}

function stripTags(value: string): string {
  return (value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function firstIndexOf(html: string, pattern: RegExp): number {
  const match = html.match(pattern);
  return match?.index ?? -1;
}

function stripImportedSourceHero(html: string, title: string): string {
  let next = stripLeadingDuplicateTitle(html, title).trimStart();
  const firstParagraph = firstIndexOf(next, /<p\b/i);
  const firstToc = firstIndexOf(next, /<h[2-4]\b[^>]*>\s*(?:<a\b[^>]*>\s*<\/a>\s*)?Table of Contents\s*<\/h[2-4]>/i);
  const candidates = [firstParagraph, firstToc].filter(index => index >= 0);
  const boundary = candidates.length ? Math.min(...candidates) : -1;
  if (boundary > 0 && boundary < 4000) {
    const prefix = next.slice(0, boundary);
    if (/<(?:img|figure)\b|Search term:|Word Count:|Created:|min read|words|author/i.test(prefix)) {
      next = next.slice(boundary).trimStart();
    }
  }
  return next;
}

function headingId(text: string, index: number): string {
  const slug = normalizeText(text).replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return slug || `section-${index + 1}`;
}

function addHeadingIdsAndTocLinks(html: string): string {
  const headingIds = new Map<string, string>();
  const used = new Map<string, number>();
  let count = 0;
  let next = html.replace(/<h([2-4])\b([^>]*)>([\s\S]*?)<\/h\1>/gi, (match, level: string, attrs: string, inner: string) => {
    const text = normalizeText(inner);
    if (!text || text === 'table of contents') return match;
    const base = headingId(inner, count);
    const seen = used.get(base) || 0;
    used.set(base, seen + 1);
    const id = seen ? `${base}-${seen + 1}` : base;
    headingIds.set(text, id);
    count += 1;
    const cleanAttrs = attrs.replace(/\s+id=(["']).*?\1/i, '').trim();
    return `<h${level}${cleanAttrs ? ` ${cleanAttrs}` : ''} id="${attr(id)}">${inner}</h${level}>`;
  });

  next = next.replace(/(<h[2-4]\b[^>]*>\s*(?:<a\b[^>]*>\s*<\/a>\s*)?Table of Contents\s*<\/h[2-4]>\s*<ul>)([\s\S]*?)(<\/ul>)/i, (_match, start: string, items: string, end: string) => {
    const linked = items.replace(/<li>\s*<a\b[^>]*>([\s\S]*?)<\/a>\s*<\/li>/gi, (_item, label: string) => {
      const text = normalizeText(label);
      if (!text || text === 'table of contents') return '';
      const id = headingIds.get(text);
      return id ? `<li><a href="#${attr(id)}">${escapeHtml(stripTags(label))}</a></li>` : `<li>${escapeHtml(stripTags(label))}</li>`;
    });
    return `${start}${linked}${end}`;
  });

  return next;
}

function normalizeRelatedCards(anchors: string): string {
  return anchors.replace(/(<a\b[^>]*>)([\s\S]*?)(<\/a>)/gi, (match, start: string, inner: string, end: string) => {
    if (/\b(?:related-meta|vls-blog-related-meta)\b/.test(inner)) return match;
    const next = inner.replace(/(<\/h3>\s*)([^<]+)\s*$/i, (_metaMatch, headingEnd: string, meta: string) => {
      const text = meta.replace(/\s+/g, ' ').trim();
      return text ? `${headingEnd}<span class="related-meta">${escapeHtml(text)}</span>` : headingEnd;
    });
    return `${start}${next}${end}`;
  });
}

function wrapRelatedArticles(html: string): string {
  return html.replace(/<h2\b[^>]*>\s*More Articles\s*<\/h2>\s*((?:\s*<a\b[\s\S]*?<\/a>\s*)+)/i, (_match, anchors: string) => {
    return `<section class="related"><h2>More Articles</h2><div class="related-grid">${normalizeRelatedCards(anchors)}</div></section>`;
  });
}

function prepareArticleBody(html: string, title: string): string {
  return wrapRelatedArticles(addHeadingIdsAndTocLinks(stripImportedSourceHero(html, title)));
}

function shareLinks(post: BlogPost): string {
  const url = blogUrl(post);
  const title = post.title || 'VLS Learning Blog';
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);
  return `<div class="share" aria-label="Share this article"><strong>Share</strong><div class="share-links"><a href="https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}" target="_blank" rel="noopener" aria-label="Share on Facebook">f</a><a href="https://www.linkedin.com/shareArticle?mini=true&url=${encodedUrl}&title=${encodedTitle}" target="_blank" rel="noopener" aria-label="Share on LinkedIn">in</a><a href="https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}" target="_blank" rel="noopener" aria-label="Share on X">X</a></div></div>`;
}

function formatDate(value: string): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function blogTopicSlug(topic: string): string {
  return slugify(topic || 'blog');
}

export function blogUrl(post: BlogPost): string {
  return `/blog/${blogTopicSlug(post.topic)}/${post.slug}`;
}

function featuredImage(post: BlogPost): string {
  return post.featuredImagePath || post.images?.[0]?.localPath || '';
}

function safeHex(value: string | undefined, fallback = '#0d1f3c'): string {
  return /^#[0-9a-fA-F]{6}$/.test(String(value || '').trim()) ? String(value).trim() : fallback;
}

function heroBackground(image: string, color: string): string {
  const overlay = `linear-gradient(90deg, ${color}f2 0%, ${color}cc 42%, ${color}73 100%)`;
  return image ? `${overlay}, url('${attr(image)}')` : `linear-gradient(135deg, ${color} 0%, #14345f 100%)`;
}

function layout(title: string, description: string, body: string, canonical: string, image = ''): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${attr(description)}">
  <link rel="canonical" href="${attr(canonical)}">
  <meta property="og:title" content="${attr(title)}">
  <meta property="og:description" content="${attr(description)}">
  ${image ? `<meta property="og:image" content="${attr(image)}">` : ''}
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    body{margin:0;font-family:Poppins,Arial,sans-serif;background:#f5f8fc;color:#0d1f3c;scroll-behavior:smooth}*{box-sizing:border-box}a{color:#1f73b7;text-decoration:none;font-weight:700}.wrap{max-width:1160px;margin:0 auto;padding:46px 24px}.top{background:#fff;border-bottom:1px solid #e1e8f1}.top .wrap{padding-top:18px;padding-bottom:18px}.brand{font-weight:800;color:#0d1f3c}.kicker{display:inline-flex;border-radius:999px;background:rgba(114,205,244,.18);color:#72cdf4;border:1px solid rgba(114,205,244,.35);font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;padding:7px 12px}.hero-banner{background-size:cover;background-position:center;min-height:390px;display:flex;align-items:end}.hero-banner .wrap{width:100%;padding-top:86px;padding-bottom:70px}.hero-banner h1{font-size:clamp(34px,5vw,58px);line-height:1.05;margin:18px 0 14px;letter-spacing:0;color:#fff!important;max-width:920px;text-shadow:0 2px 18px rgba(0,0,0,.22)}.meta{display:flex;flex-wrap:wrap;gap:10px;color:#dbeafe;font-size:13px;margin:0}.layout{display:grid;grid-template-columns:minmax(0,1fr) 260px;gap:34px;align-items:start}.article{background:#fff;border:1px solid #e1e8f1;border-radius:8px;padding:38px;box-shadow:0 18px 45px rgba(13,31,60,.08)}.article h2{font-size:28px;line-height:1.2;margin:34px 0 12px;color:#0d1f3c}.article h3{font-size:22px;line-height:1.3;margin:28px 0 10px;color:#14345f}.article p,.article li{font-size:16px;line-height:1.75;color:#42526b}.article img{display:block;width:100%;height:auto;border-radius:8px;margin:24px 0;border:1px solid #e1e8f1}.article table{width:100%;border-collapse:collapse;margin:24px 0;font-size:14px}.article th,.article td{border:1px solid #dbe5f1;padding:10px;text-align:left;vertical-align:top}.article th{background:#f1f6fc}.related,.vls-blog-related{margin-top:34px}.related h2,.vls-blog-related h2{margin-top:0}.related-grid,.vls-blog-related-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}.related-grid>a,.vls-blog-related-grid>a{display:flex;flex-direction:column;min-width:0;background:#fff;border:1px solid #e1e8f1;border-radius:8px;overflow:hidden;box-shadow:0 10px 24px rgba(13,31,60,.06);color:#667085!important;font-size:12px;font-weight:500;line-height:1.5;text-decoration:none}.related-grid>a img,.vls-blog-related-grid>a img{width:100%;height:112px;object-fit:cover;border:0;border-radius:0;margin:0;background:#dbe5f1}.related-grid>a h3,.vls-blog-related-grid>a h3{font-size:15px;line-height:1.35;margin:12px 14px 6px;color:#0d1f3c}.related-grid>a>:not(img):not(h3),.vls-blog-related-grid>a>:not(img):not(h3),.related-meta,.vls-blog-related-meta{display:block;margin:0 14px 14px}.side{position:sticky;top:24px;background:#fff;border:1px solid #e1e8f1;border-radius:8px;padding:18px;box-shadow:0 12px 30px rgba(13,31,60,.06)}.tags{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}.tag{border-radius:999px;background:#f1f6fc;color:#24466f;padding:6px 10px;font-size:12px;font-weight:700}.share{margin-bottom:20px}.share strong{display:block;margin-bottom:10px;color:#0d1f3c}.share-links{display:flex;gap:8px}.share-links a{display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:8px;background:#f1f6fc;color:#0d1f3c;text-decoration:none;font-size:13px;font-weight:800}.toolbar{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-top:24px}.filter,.search{border:1px solid #d6e0eb;background:#fff;border-radius:999px;padding:9px 14px;font:600 13px Poppins,Arial,sans-serif;color:#334155}.filter.is-active{background:#1f73b7;color:#fff;border-color:#1f73b7}.search{margin-left:auto;min-width:260px;border-radius:8px;font-weight:500}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;margin-top:24px}.card{display:flex;flex-direction:column;background:#fff;border:1px solid #e1e8f1;border-radius:8px;overflow:hidden;box-shadow:0 14px 34px rgba(13,31,60,.07)}.card .kicker{background:#e8f3fc;color:#1f73b7;border:0}.card img{width:100%;height:180px;object-fit:cover;background:#dbe5f1}.card-body{padding:18px;display:flex;flex-direction:column;gap:10px;flex:1}.card h2{font-size:18px;line-height:1.3;margin:0;color:#0d1f3c}.card p{font-size:14px;line-height:1.6;margin:0;color:#42526b}.card .meta{color:#667085;margin:0}.pagination{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:8px;margin-top:28px}.page-btn{border:1px solid #d6e0eb;background:#fff;border-radius:8px;padding:8px 12px;font:700 13px Poppins,Arial,sans-serif;color:#24466f;cursor:pointer}.page-btn.is-active{background:#1f73b7;border-color:#1f73b7;color:#fff}.page-btn:disabled{opacity:.45;cursor:not-allowed}.page-status{font-size:13px;color:#64748b;margin-left:8px}@media(max-width:900px){.layout{grid-template-columns:1fr}.side{position:static}.grid{grid-template-columns:1fr 1fr}.article{padding:24px}.search{margin-left:0;width:100%}}@media(max-width:720px){.related-grid,.vls-blog-related-grid{grid-template-columns:1fr}.related-grid>a img,.vls-blog-related-grid>a img{height:150px}}@media(max-width:620px){.wrap{padding:28px 16px}.grid{grid-template-columns:1fr}.hero-banner{min-height:340px}.hero-banner .wrap{padding-top:58px;padding-bottom:48px}.hero-banner h1{font-size:34px}.article{padding:18px}}
  </style>
</head>
<body>
  <header class="top"><div class="wrap" style="padding-top:18px;padding-bottom:18px"><a class="brand" href="/">VLS Online</a></div></header>
  ${body}
</body>
</html>`;
}

export function renderBlogArticle(post: BlogPost, settings: BlogSettings = {}): string {
  const description = post.metaDescription || post.summary;
  const tags = post.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('');
  const articleHtml = prepareArticleBody(rewriteArticleLinks(post.bodyHtml), post.title);
  const image = featuredImage(post);
  const gradientColor = safeHex(settings.heroGradientColor);
  const background = heroBackground(image, gradientColor);
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description,
    image: image ? [image] : undefined,
    author: post.author ? { '@type': 'Person', name: post.author } : undefined,
    datePublished: post.publishDate || post.createdDate,
    dateModified: post.updatedDate,
    mainEntityOfPage: post.canonicalUrl || blogUrl(post),
  };
  const body = `<section class="hero-banner" style="background-image:${attr(background)}">
    <div class="wrap">
      <span class="kicker">${escapeHtml(post.topic)}</span>
      <h1>${escapeHtml(post.title)}</h1>
      <div class="meta">${post.publishDate ? `<span>${escapeHtml(formatDate(post.publishDate))}</span>` : ''}</div>
    </div>
  </section>
  <main class="wrap">
    <div class="layout">
      <article class="article">${articleHtml}</article>
      <aside class="side">${shareLinks(post)}<strong>Topic</strong><div class="tags"><span class="tag">${escapeHtml(post.topic)}</span></div>${tags ? `<strong style="display:block;margin-top:18px">Tags</strong><div class="tags">${tags}</div>` : ''}</aside>
    </div>
    <script type="application/ld+json">${JSON.stringify(schema).replace(/</g, '\\u003c')}<\/script>
  </main>`;
  return layout(post.metaTitle || post.title, description, body, post.canonicalUrl || blogUrl(post), image);
}

export function renderBlogLanding(posts: BlogPost[]): string {
  const published = posts.filter(post => post.status === 'published');
  const topics = ['All', ...Array.from(new Set(published.map(post => post.topic))).sort()];
  const filters = topics.map(topic => `<button type="button" class="filter${topic === 'All' ? ' is-active' : ''}" data-topic="${attr(topic)}">${escapeHtml(topic)}</button>`).join('');
  const cards = published.map(post => `<article class="card" data-topic="${attr(post.topic)}" data-search="${attr(`${post.title} ${post.summary} ${post.topic} ${post.tags.join(' ')}`.toLowerCase())}">
    ${featuredImage(post) ? `<img src="${attr(featuredImage(post))}" alt="${attr(post.title)}">` : ''}
    <div class="card-body"><span class="kicker">${escapeHtml(post.topic)}</span><h2>${escapeHtml(post.title)}</h2><div class="meta">${post.publishDate ? `<span>${escapeHtml(formatDate(post.publishDate))}</span>` : ''}</div><p>${escapeHtml(post.summary)}</p><a href="${attr(blogUrl(post))}">Read more</a></div>
  </article>`).join('');
  const body = `<main class="wrap">
    <span class="kicker">VLS Online</span>
    <h1>VLS Learning Blog</h1>
    <p style="max-width:760px;line-height:1.75;color:#42526b">Practical guidance for ACCA learners, finance professionals and ambitious students preparing for exams, career moves and technical accounting challenges.</p>
    <div class="toolbar">${filters}<input class="search" type="search" placeholder="Search blog posts" aria-label="Search blog posts"></div>
    <section class="grid">${cards || '<p>No published blog posts yet.</p>'}</section>
    <nav class="pagination" aria-label="Blog pagination"></nav>
  </main>
  <script>(function(){var topic='All';var search='';var page=1;var perPage=9;var pager=document.querySelector('.pagination');function matches(card){var topicOk=topic==='All'||card.getAttribute('data-topic')===topic;var searchOk=!search||String(card.getAttribute('data-search')||'').indexOf(search)>-1;return topicOk&&searchOk;}function button(label,target,active,disabled){return '<button type="button" class="page-btn'+(active?' is-active':'')+'" data-page="'+target+'"'+(disabled?' disabled':'')+'>'+label+'</button>';}function renderPager(totalPages,total){if(!pager)return;if(totalPages<=1){pager.innerHTML='';return;}var html=button('Prev',Math.max(1,page-1),false,page===1);for(var i=1;i<=totalPages;i++){html+=button(String(i),i,i===page,false);}html+=button('Next',Math.min(totalPages,page+1),false,page===totalPages);html+='<span class="page-status">'+total+' posts</span>';pager.innerHTML=html;}function apply(){document.querySelectorAll('.filter').forEach(function(btn){btn.classList.toggle('is-active',btn.getAttribute('data-topic')===topic);});var cards=Array.prototype.slice.call(document.querySelectorAll('.card'));var matched=cards.filter(matches);var totalPages=Math.max(1,Math.ceil(matched.length/perPage));if(page>totalPages)page=totalPages;cards.forEach(function(card){card.hidden=true;});matched.forEach(function(card,index){card.hidden=index<(page-1)*perPage||index>=page*perPage;});renderPager(totalPages,matched.length);}document.addEventListener('click',function(event){var filter=event.target.closest('.filter');if(filter){topic=filter.getAttribute('data-topic')||'All';page=1;apply();return;}var pageBtn=event.target.closest('.page-btn[data-page]');if(pageBtn&&!pageBtn.disabled){page=Number(pageBtn.getAttribute('data-page'))||1;apply();}});var input=document.querySelector('.search');if(input)input.addEventListener('input',function(){search=String(input.value||'').toLowerCase();page=1;apply();});apply();})();<\/script>`;
  return layout('VLS Learning Blog', 'ACCA, accounting, finance and career guidance from VLS Online tutors and learning specialists.', body, '/blog');
}

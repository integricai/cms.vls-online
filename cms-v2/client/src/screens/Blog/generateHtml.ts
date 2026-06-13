import type { BlogPost } from '../../types/cms';
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

function bodyWithAbsoluteAssets(html: string): string {
  return html
    .replace(/(<img\b[^>]*\ssrc=["'])(\/blog-assets\/[^"']+)(["'][^>]*>)/gi, (_match, start: string, src: string, end: string) => {
      return `${start}${absoluteAssetUrl(src)}${end}`;
    })
    .replace(/(<a\b[^>]*\shref=["'])(?:https?:\/\/(?:blog\.)?vls-online\.com)?\/post\/([^"'?#/]+)[^"']*(["'][^>]*>)/gi, (_match, start: string, slug: string, end: string) => {
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

function stripTags(value: string): string {
  return (value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function wrapRelatedArticles(html: string): string {
  return html.replace(/<h2\b[^>]*>\s*More Articles\s*<\/h2>\s*((?:\s*<a\b[\s\S]*?<\/a>\s*)+)/i, (_match, anchors: string) => {
    return `<section class="vls-blog-related"><h2>More Articles</h2><div class="vls-blog-related-grid">${anchors}</div></section>`;
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

function formatDate(value: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function articleSchema(post: BlogPost): string {
  const featuredImage = absoluteAssetUrl(post.featuredImagePath);
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.metaDescription || post.summary,
    image: featuredImage ? [featuredImage] : undefined,
    author: post.author ? { '@type': 'Person', name: post.author } : undefined,
    datePublished: post.publishDate || post.createdDate,
    dateModified: post.updatedDate,
    mainEntityOfPage: post.canonicalUrl || blogUrl(post),
  };
  return `<script type="application/ld+json">${JSON.stringify(schema).replace(/</g, '\\u003c')}<\/script>`;
}

const baseCss = `<style>
.vls-blog{font-family:Poppins,Arial,sans-serif;color:#0d1f3c;background:linear-gradient(180deg,#0d1f3c 0,#0d1f3c 430px,#f5f8fc 430px,#f5f8fc 100%);margin-top:34px;scroll-behavior:smooth;}
.vls-blog *{box-sizing:border-box;}
.vls-blog a{color:#1f73b7;text-decoration:none;font-weight:700;}
.vls-blog-shell{max-width:1160px;margin:0 auto;padding:46px 24px;}
.vls-blog-kicker{display:inline-flex;align-items:center;border-radius:999px;background:#e8f3fc;color:#1f73b7;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;padding:7px 12px;}
.vls-blog>.vls-blog-shell>.vls-blog-kicker{background:#14345f;color:#72cdf4;border:1px solid rgba(114,205,244,.28);}
html body .vls-blog .vls-blog-shell>h1{font-size:clamp(34px,5vw,58px);line-height:1.05;margin:18px 0 14px;letter-spacing:0;color:#fff!important;-webkit-text-fill-color:#fff!important;max-width:920px;}
.vls-blog h2{font-size:28px;line-height:1.2;margin:34px 0 12px;color:#0d1f3c;}
.vls-blog h3{font-size:22px;line-height:1.3;margin:28px 0 10px;color:#14345f;}
.vls-blog p,.vls-blog li{font-size:16px;line-height:1.75;color:#42526b;}
.vls-blog>.vls-blog-shell>p{color:#dbeafe;}
.vls-blog-meta{display:flex;flex-wrap:wrap;gap:10px;color:#dbeafe;font-size:13px;margin:0 0 24px;}
.vls-blog-card .vls-blog-meta,.vls-blog-side .vls-blog-meta{color:#667085;}
.vls-blog-hero{width:100%;max-height:520px;object-fit:cover;border-radius:8px;border:1px solid #dbe5f1;background:#dbe5f1;margin:18px 0 30px;box-shadow:0 20px 45px rgba(13,31,60,.18);}
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
.vls-blog-related-grid>a>:not(img):not(h3),.related-grid>a>:not(img):not(h3){margin:0 14px 14px;}
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
@media(max-width:620px){.vls-blog{margin-top:28px}.vls-blog-shell{padding:28px 16px}.vls-blog-grid{grid-template-columns:1fr}.vls-blog h1{font-size:34px}.vls-blog-article{padding:18px}}
</style>`;

export function generateBlogArticleHtml(post: BlogPost): string {
  const metaDescription = post.metaDescription || post.summary;
  const featuredImage = absoluteAssetUrl(post.featuredImagePath);
  const tags = post.tags.map(tag => `<span class="vls-blog-tag">${escapeHtml(tag)}</span>`).join('');
  const bodyHtml = prepareArticleBody(bodyWithAbsoluteAssets(post.bodyHtml), post.title);
  return `<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<title>${escapeHtml(post.metaTitle || post.title)}</title>
<meta name="description" content="${attr(metaDescription)}">
<link rel="canonical" href="${attr(post.canonicalUrl || blogUrl(post))}">
<meta property="og:title" content="${attr(post.metaTitle || post.title)}">
<meta property="og:description" content="${attr(metaDescription)}">
${featuredImage ? `<meta property="og:image" content="${attr(featuredImage)}">` : ''}
${baseCss}
<main class="vls-blog">
  <div class="vls-blog-shell">
    <span class="vls-blog-kicker">${escapeHtml(post.topic)}</span>
    <h1 style="color:#ffffff!important;-webkit-text-fill-color:#ffffff!important;">${escapeHtml(post.title)}</h1>
    <div class="vls-blog-meta">${post.publishDate ? `<span>${escapeHtml(formatDate(post.publishDate))}</span>` : ''}<span>${escapeHtml(post.status)}</span></div>
    <div class="vls-blog-layout">
      <article class="vls-blog-article">${bodyHtml}</article>
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
    ${post.featuredImagePath ? `<img src="${attr(absoluteAssetUrl(post.featuredImagePath))}" alt="${attr(post.title)}">` : ''}
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

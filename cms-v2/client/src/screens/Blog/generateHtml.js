import { escapeHtml } from '../../utils/text';
function attr(value) {
    return escapeHtml(value || '').replace(/"/g, '&quot;');
}
function topicSlug(topic) {
    return (topic || 'blog').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'blog';
}
export function blogUrl(post) {
    return `/blog/${topicSlug(post.topic)}/${post.slug}`;
}
function absoluteBlogUrl(post) {
    return `https://vls-online.com${blogUrl(post)}`;
}
function formatDate(value) {
    if (!value)
        return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime()))
        return value;
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}
function articleSchema(post) {
    const schema = {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: post.title,
        description: post.metaDescription || post.summary,
        image: post.featuredImagePath ? [post.featuredImagePath] : undefined,
        author: post.author ? { '@type': 'Person', name: post.author } : undefined,
        datePublished: post.publishDate || post.createdDate,
        dateModified: post.updatedDate,
        mainEntityOfPage: post.canonicalUrl || blogUrl(post),
    };
    return `<script type="application/ld+json">${JSON.stringify(schema).replace(/</g, '\\u003c')}<\/script>`;
}
const baseCss = `<style>
.vls-blog{font-family:Poppins,Arial,sans-serif;color:#0d1f3c;background:linear-gradient(180deg,#0d1f3c 0,#0d1f3c 250px,#f5f8fc 250px,#f5f8fc 100%);}
.vls-blog *{box-sizing:border-box;}
.vls-blog a{color:#1f73b7;text-decoration:none;font-weight:700;}
.vls-blog-shell{max-width:1160px;margin:0 auto;padding:46px 24px;}
.vls-blog-kicker{display:inline-flex;align-items:center;border-radius:999px;background:#e8f3fc;color:#1f73b7;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;padding:7px 12px;}
.vls-blog>.vls-blog-shell>.vls-blog-kicker{background:#14345f;color:#72cdf4;border:1px solid rgba(114,205,244,.28);}
.vls-blog h1{font-size:clamp(34px,5vw,58px);line-height:1.05;margin:18px 0 14px;letter-spacing:0;color:#fff;max-width:920px;}
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
.vls-blog-side{position:sticky;top:24px;background:#fff;border:1px solid #e1e8f1;border-radius:8px;padding:18px;box-shadow:0 12px 30px rgba(13,31,60,.06);}
.vls-blog-tags{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;}
.vls-blog-tag{border-radius:999px;background:#f1f6fc;color:#24466f;padding:6px 10px;font-size:12px;font-weight:700;}
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
@media(max-width:900px){.vls-blog-layout{grid-template-columns:1fr}.vls-blog-side{position:static}.vls-blog-grid{grid-template-columns:1fr 1fr}.vls-blog-article{padding:24px}.vls-blog-search{margin-left:0;width:100%;}}
@media(max-width:620px){.vls-blog-shell{padding:28px 16px}.vls-blog-grid{grid-template-columns:1fr}.vls-blog h1{font-size:34px}.vls-blog-article{padding:18px}}
</style>`;
export function generateBlogArticleHtml(post) {
    const metaDescription = post.metaDescription || post.summary;
    const tags = post.tags.map(tag => `<span class="vls-blog-tag">${escapeHtml(tag)}</span>`).join('');
    const featured = post.featuredImagePath
        ? `<img class="vls-blog-hero" src="${attr(post.featuredImagePath)}" alt="${attr(post.title)}">`
        : '';
    return `<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<title>${escapeHtml(post.metaTitle || post.title)}</title>
<meta name="description" content="${attr(metaDescription)}">
<link rel="canonical" href="${attr(absoluteBlogUrl(post))}">
<meta property="og:title" content="${attr(post.metaTitle || post.title)}">
<meta property="og:description" content="${attr(metaDescription)}">
${post.featuredImagePath ? `<meta property="og:image" content="${attr(post.featuredImagePath)}">` : ''}
${baseCss}
<main class="vls-blog">
  <div class="vls-blog-shell">
    <span class="vls-blog-kicker">${escapeHtml(post.topic)}</span>
    <h1>${escapeHtml(post.title)}</h1>
    <div class="vls-blog-meta">${post.author ? `<span>${escapeHtml(post.author)}</span>` : ''}${post.publishDate ? `<span>${escapeHtml(formatDate(post.publishDate))}</span>` : ''}<span>${escapeHtml(post.status)}</span></div>
    ${featured}
    <div class="vls-blog-layout">
      <article class="vls-blog-article">${post.bodyHtml}</article>
      <aside class="vls-blog-side">
        <strong>Topic</strong>
        <div class="vls-blog-tags"><span class="vls-blog-tag">${escapeHtml(post.topic)}</span></div>
        ${tags ? `<strong style="display:block;margin-top:18px">Tags</strong><div class="vls-blog-tags">${tags}</div>` : ''}
      </aside>
    </div>
  </div>
</main>
${articleSchema(post)}`;
}
export function generateBlogLandingHtml(posts) {
    const published = posts.filter(post => post.status === 'published');
    const topics = ['All', ...Array.from(new Set(published.map(post => post.topic))).sort()];
    const filters = topics.map(topic => `<button type="button" class="vls-blog-filter${topic === 'All' ? ' is-active' : ''}" data-topic="${attr(topic)}">${escapeHtml(topic)}</button>`).join('');
    const cards = published.map(post => `<article class="vls-blog-card" data-topic="${attr(post.topic)}" data-search="${attr(`${post.title} ${post.summary} ${post.topic} ${post.tags.join(' ')}`.toLowerCase())}">
    ${post.featuredImagePath ? `<img src="${attr(post.featuredImagePath)}" alt="${attr(post.title)}">` : ''}
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
    <h1>VLS Learning Blog</h1>
    <p style="max-width:760px">Practical guidance for ACCA learners, finance professionals and ambitious students preparing for exams, career moves and technical accounting challenges.</p>
    <div class="vls-blog-toolbar">${filters}<input class="vls-blog-search" type="search" placeholder="Search blog posts" aria-label="Search blog posts"></div>
    <section class="vls-blog-grid">${cards || '<p>No published blog posts yet.</p>'}</section>
  </div>
</main>
<script>(function(){var root=document.currentScript.previousElementSibling;var topic='All';var search='';function apply(){root.querySelectorAll('.vls-blog-filter').forEach(function(btn){btn.classList.toggle('is-active',btn.getAttribute('data-topic')===topic);});root.querySelectorAll('.vls-blog-card').forEach(function(card){var topicOk=topic==='All'||card.getAttribute('data-topic')===topic;var searchOk=!search||String(card.getAttribute('data-search')||'').indexOf(search)>-1;card.hidden=!(topicOk&&searchOk);});}root.addEventListener('click',function(event){var btn=event.target.closest('.vls-blog-filter');if(btn){topic=btn.getAttribute('data-topic')||'All';apply();}});var input=root.querySelector('.vls-blog-search');if(input)input.addEventListener('input',function(){search=String(input.value||'').toLowerCase();apply();});})();<\/script>`;
}

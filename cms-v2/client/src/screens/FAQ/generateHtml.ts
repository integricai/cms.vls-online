import type { FaqItem, TextValue } from '../../types/cms';
import { escapeHtml, normalize, textStyle } from '../../utils/text';

function textContent(value: TextValue | undefined) {
  if (!value) return '';
  return typeof value === 'string' ? value : value.text || '';
}

function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, '');
}

function answerInnerHtml(item: FaqItem) {
  const heading = normalize(item.heading, 'faqHeading');
  const para = normalize(item.para, 'faq');
  const bullets = item.items || [];
  const lines: string[] = [];

  if ((item.type === 'heading-para' || item.type === 'heading-bullets') && heading.text) {
    lines.push(`<h3 style="font-family:Poppins,sans-serif;margin:0 0 8px;text-align:left;${textStyle(heading)}">${escapeHtml(heading.text)}</h3>`);
  }

  if ((item.type === 'paragraph' || item.type === 'heading-para') && para.text) {
    lines.push(`<p style="font-family:Poppins,sans-serif;line-height:1.7;margin:0 0 8px;text-align:left;${textStyle(para)}">${para.text}</p>`);
  }

  if ((item.type === 'bullets' || item.type === 'heading-bullets') && bullets.length) {
    lines.push('<ul style="padding-left:0;list-style:none;margin:0 0 4px;">');
    bullets.forEach(entry => {
      const bullet = normalize(entry, 'faqBullet');
      if (!bullet.text.trim()) return;
      lines.push(`<li style="font-family:Poppins,sans-serif;line-height:1.7;display:flex;gap:8px;align-items:flex-start;padding:2px 0;text-align:left;${textStyle(bullet)}"><span style="color:#534AB7;font-weight:700;flex-shrink:0;margin-top:2px;">&bull;</span>${escapeHtml(bullet.text)}</li>`);
    });
    lines.push('</ul>');
  }

  return lines.join('\n');
}

function answerPlainText(item: FaqItem) {
  const parts: string[] = [];
  const heading = textContent(item.heading);
  const para = textContent(item.para);
  if (heading) parts.push(heading);
  if (para) parts.push(stripHtml(para));
  if (item.items?.length) parts.push(item.items.map(textContent).filter(Boolean).join('. '));
  return parts.join(' ');
}

export function generateFaqHtml(items: FaqItem[]) {
  const valid = items.filter(item => textContent(item.question).trim());
  if (!valid.length) return '<!-- Add FAQ items and generate HTML -->';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: valid.map(item => ({
      '@type': 'Question',
      name: textContent(item.question),
      acceptedAnswer: { '@type': 'Answer', text: answerPlainText(item) },
    })),
  };
  const uid = `vlsfaq${Math.random().toString(36).slice(2, 7)}`;
  const lines: string[] = [];

  lines.push('<script type="application/ld+json">');
  lines.push(JSON.stringify(jsonLd, null, 2));
  lines.push('</script>');
  lines.push('');
  lines.push('<style>');
  lines.push(`.${uid}{font-family:Poppins,sans-serif;width:100%;}`);
  lines.push(`.${uid}-item{border-bottom:1.5px solid #e5e7eb;}`);
  lines.push(`.${uid}-item:first-child{border-top:1.5px solid #e5e7eb;}`);
  lines.push(`.${uid}-btn{width:100%;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 0;background:none;border:none;cursor:pointer;font-family:Poppins,sans-serif;font-size:16px;font-weight:600;color:#1a1a1a;}`);
  lines.push(`.${uid}-btn:hover{color:#534AB7;}`);
  lines.push(`.${uid}-q{transition:color .2s ease;}`);
  lines.push(`.${uid}-btn[aria-expanded="true"] .${uid}-q{color:#534AB7 !important;}`);
  lines.push(`.${uid}-ico{width:18px;height:18px;flex-shrink:0;transition:transform .2s;stroke:#534AB7;fill:none;stroke-width:2.5;}`);
  lines.push(`.${uid}-btn[aria-expanded="true"] .${uid}-ico{transform:rotate(180deg);}`);
  lines.push(`.${uid}-ans{display:none;padding:0 0 16px;}`);
  lines.push(`.${uid}-ans.open{display:block;}`);
  lines.push('</style>');
  lines.push('');
  lines.push(`<div class="${uid}">`);
  valid.forEach(item => {
    const question = normalize(item.question, 'faqQuestion');
    lines.push(`  <div class="${uid}-item" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">`);
    lines.push(`    <button class="${uid}-btn" aria-expanded="false" onclick="${uid}T(this)">`);
    lines.push(`      <span class="${uid}-q" itemprop="name" style="${textStyle(question)}">${escapeHtml(question.text)}</span>`);
    lines.push(`      <svg class="${uid}-ico" viewBox="0 0 24 24" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>`);
    lines.push('    </button>');
    lines.push(`    <div class="${uid}-ans" itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer">`);
    lines.push('      <div itemprop="text">');
    lines.push(`        ${answerInnerHtml(item)}`);
    lines.push('      </div>');
    lines.push('    </div>');
    lines.push('  </div>');
  });
  lines.push('</div>');
  lines.push('');
  lines.push('<script>');
  lines.push('(function(){');
  lines.push(`  function ${uid}T(btn){`);
  lines.push('    var open=btn.getAttribute("aria-expanded")==="true";');
  lines.push(`    var wrap=btn.closest(".${uid}");`);
  lines.push(`    wrap.querySelectorAll(".${uid}-btn").forEach(function(b){b.setAttribute("aria-expanded","false");});`);
  lines.push(`    wrap.querySelectorAll(".${uid}-ans").forEach(function(a){a.classList.remove("open");});`);
  lines.push('    if(!open){btn.setAttribute("aria-expanded","true");btn.nextElementSibling.classList.add("open");}');
  lines.push('  }');
  lines.push(`  window.${uid}T=${uid}T;`);
  lines.push('})();');
  lines.push('</script>');

  return lines.join('\n');
}

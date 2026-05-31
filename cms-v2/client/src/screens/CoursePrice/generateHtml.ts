import type { CoursePrice } from '../../types/cms';
import { escapeHtml } from '../../utils/text';

export function clampDiscount(value: number): number {
  return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
}

export function money(value: number): string {
  const rounded = Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

export function calculatedPrice(
  price: CoursePrice,
  option: 1 | 2 = 1,
): { discount: number; yourPrice: number; saving: number; regular: number } {
  const regular = Math.max(0, Number(option === 1 ? price.regularPrice : price.regularPrice2) || 0);
  const discount = clampDiscount(Number(option === 1 ? price.discountPercent : price.discountPercent2) || 0);
  const saving = regular * (discount / 100);
  return {
    regular,
    discount,
    yourPrice: Math.max(0, regular - saving),
    saving,
  };
}

function fw(w: number | undefined, def: number): number {
  return [400, 500, 600, 700, 800, 900].includes(Number(w)) ? Number(w) : def;
}

function fs(v: number | undefined, min: number, max: number, def: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : def;
}

function cssValue(value: string | undefined, fallback: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(String(value || '')) ? String(value) : fallback;
}

function optionHtml(price: CoursePrice, option: 1 | 2): string {
  const calc = calculatedPrice(price, option);
  if (calc.regular <= 0) return '';

  const currency = escapeHtml(price.currency || '$');
  const hasDiscount = calc.discount > 0 && calc.saving > 0;
  const title = option === 1 ? price.plan1Title || 'Full Course' : price.plan2Title || 'Complete Package';
  const subtitle = option === 1
    ? price.plan1Subtitle || 'Complete syllabus, videos & notes'
    : price.plan2Subtitle || 'Course + live sessions + mock & tutor support';
  const badge = option === 1 ? price.plan1Badge || '' : price.plan2Badge || 'BEST VALUE';
  const checked = option === 1 ? ' checked' : '';

  return `<label class="vls-plan-option vls-plan-${option}">
    ${badge ? `<span class="vls-plan-badge">${escapeHtml(badge)}</span>` : ''}
    <input type="radio" name="vls-plan-choice" value="${option}"${checked}>
    <span class="vls-plan-radio" aria-hidden="true"></span>
    <span class="vls-plan-copy">
      <span class="vls-plan-title">${escapeHtml(title)}</span>
      <span class="vls-plan-subtitle">${escapeHtml(subtitle)}</span>
    </span>
    <span class="vls-plan-price">
      ${hasDiscount ? `<span class="vls-plan-regular">${currency}${escapeHtml(money(calc.regular))}</span>` : ''}
      <span class="vls-plan-final">${currency}${escapeHtml(money(calc.yourPrice))}</span>
      ${hasDiscount ? `<span class="vls-plan-save">Save ${currency}${escapeHtml(money(calc.saving))} (${escapeHtml(money(calc.discount))}% off)</span>` : ''}
    </span>
  </label>`;
}

export function generateCoursePriceHtml(price: CoursePrice): string {
  const accent = cssValue(price.accent, '#204280');
  const bg = cssValue(price.bg, '#ffffff');
  const border = cssValue(price.border, '#d8e0f0');
  const discountBg = cssValue(price.discountBg, '#12a85a');
  const discountTc = cssValue(price.discountTc, '#ffffff');
  const saveBg = cssValue(price.saveBg, '#ecfdf3');
  const saveBorder = cssValue(price.saveBorder, '#b7e4c7');
  const radius = Math.max(0, Math.min(40, Number(price.radius) || 14));
  const ff = (price.fontFamily || 'Poppins').replace(/['"<>]/g, '');
  const eyebrowSz = fs(price.eyebrowSize, 8, 24, 10);
  const eyebrowWt = fw(price.eyebrowWeight, 700);
  const titleSz = fs(price.titleSize, 10, 36, 11);
  const titleWt = fw(price.titleWeight, 700);
  const amountSz = fs(price.amountSize, 24, 80, 31);
  const regularSz = fs(price.regularPriceSize, 10, 28, 13);
  const discountSz = fs(price.discountSize, 9, 20, 11);
  const bodySz = fs(price.bodySize, 10, 20, 12);
  const planTitleSz = fs(price.planTitleSize, 10, 24, 13);
  const planTitleWt = fw(price.planTitleWeight, 800);
  const planSubtitleSz = fs(price.planSubtitleSize, 9, 18, 10);
  const badgeSz = fs(price.badgeSize, 8, 16, 9);
  const badgeWt = fw(price.badgeWeight, 800);
  const guaranteeSz = fs(price.guaranteeSize, 10, 18, 11);
  const guaranteeWt = fw(price.guaranteeWeight, 600);
  const ctaSz = fs(price.ctaSize, 10, 24, 14);
  const ctaWt = fw(price.ctaWeight, 800);
  const option1 = calculatedPrice(price, 1);
  const option2 = calculatedPrice(price, 2);
  const initial = option1.regular > 0 ? option1 : option2;
  const initialAmount = money(initial.yourPrice);
  const currency = escapeHtml(price.currency || '$');
  const title = price.title || 'Choose your plan';
  const ctaText = price.ctaText || 'Buy Now';
  const guaranteeTitle = price.guaranteeTitle || '7-Day Money-Back Guarantee';
  const guaranteeText = price.guaranteeText || 'Not the right fit? Get a full refund within 7 days of registration - no questions asked.';
  const checkoutText = price.checkoutText || 'Secure checkout - Instant access';

  return `<style>
.vls-plan-card{box-sizing:border-box;width:100%;max-width:300px;background:${bg};border:1px solid ${border};border-top:4px solid ${accent};border-radius:${radius}px;overflow:hidden;font-family:'${ff}',Arial,sans-serif;color:#10213d;box-shadow:0 16px 40px rgba(15,23,42,.12)}
.vls-plan-card *{box-sizing:border-box}
.vls-plan-inner{padding:16px 17px 14px}
.vls-plan-eyebrow{display:inline-flex;align-items:center;gap:6px;border-radius:999px;background:#eff6ff;color:#2454d6;padding:7px 11px;font-size:${eyebrowSz}px;font-weight:${eyebrowWt};letter-spacing:.12em;text-transform:uppercase}
.vls-plan-heading{margin:17px 0 9px;font-size:${titleSz}px;font-weight:${titleWt};letter-spacing:.08em;text-transform:uppercase;color:#23365d}
.vls-plan-list{display:grid;gap:10px}
.vls-plan-option{position:relative;display:grid;grid-template-columns:18px 1fr auto;gap:8px;align-items:center;min-height:92px;border:1px solid #e3e9f4;border-radius:12px;padding:15px 13px;background:#fff;cursor:pointer;transition:border-color .15s,box-shadow .15s}
.vls-plan-option:has(input:checked){border-color:${accent};box-shadow:0 0 0 1px ${accent},0 10px 24px rgba(32,66,128,.12)}
.vls-plan-option input{position:absolute;opacity:0;pointer-events:none}
.vls-plan-radio{width:15px;height:15px;border-radius:999px;border:1px solid #b8c7e1;box-shadow:inset 0 0 0 3px #fff}
.vls-plan-option:has(input:checked) .vls-plan-radio{background:${accent};border-color:${accent}}
.vls-plan-copy{min-width:0;display:grid;gap:2px}
.vls-plan-title{font-size:${planTitleSz}px;font-weight:${planTitleWt};line-height:1.1;color:#0d1f3c}
.vls-plan-subtitle{font-size:${planSubtitleSz}px;line-height:1.25;color:#61708a}
.vls-plan-price{display:grid;justify-items:end;gap:3px;min-width:88px}
.vls-plan-regular{font-size:${regularSz}px;font-weight:700;color:#718096;text-decoration:line-through}
.vls-plan-final{font-size:${amountSz}px;font-weight:900;line-height:1;color:#0d2558}
.vls-plan-save{border-radius:5px;background:${discountBg};color:${discountTc};padding:4px 7px;font-size:${discountSz}px;font-weight:800;line-height:1.1;white-space:nowrap}
.vls-plan-badge{position:absolute;right:10px;top:-9px;border-radius:999px;background:#0d1f4f;color:#fff;padding:4px 8px;font-size:${badgeSz}px;font-weight:${badgeWt};letter-spacing:.06em}
.vls-plan-guarantee{display:grid;grid-template-columns:28px 1fr;gap:10px;align-items:start;margin-top:24px;border:1px solid ${saveBorder};background:${saveBg};border-radius:9px;padding:11px;color:#0c6b3f}
.vls-plan-shield{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:999px;background:#fff;border:1px solid #cdeed9;font-size:16px}
.vls-plan-guarantee-title{font-size:${guaranteeSz}px;font-weight:${guaranteeWt};line-height:1.2}
.vls-plan-guarantee-text{margin-top:3px;font-size:${bodySz}px;line-height:1.35;color:#397250}
.vls-plan-cta{display:flex;align-items:center;justify-content:center;gap:10px;margin-top:14px;width:100%;border:0;border-radius:8px;background:#0d2b66;color:#fff;text-decoration:none;padding:13px 14px;font-size:${ctaSz}px;font-weight:${ctaWt};box-shadow:0 10px 20px rgba(13,43,102,.28)}
.vls-plan-checkout{margin:10px 0 0;text-align:center;color:#6c7a92;font-size:10px;font-weight:500}
@media(max-width:640px){.vls-plan-card{max-width:none}.vls-plan-option{grid-template-columns:18px 1fr}.vls-plan-price{grid-column:2;justify-items:start}.vls-plan-final{font-size:${Math.max(24, amountSz - 3)}px}}
</style><div class="vls-plan-card" data-vls-plan-card-root>
  <div class="vls-plan-inner">
    ${price.eyebrow ? `<div class="vls-plan-eyebrow">${escapeHtml(price.eyebrow)}</div>` : ''}
    <div class="vls-plan-heading">${escapeHtml(title)}</div>
    <div class="vls-plan-list">
      ${optionHtml(price, 1)}
      ${optionHtml(price, 2)}
    </div>
    <div class="vls-plan-guarantee">
      <span class="vls-plan-shield">♡</span>
      <span><span class="vls-plan-guarantee-title">${escapeHtml(guaranteeTitle)}</span><span class="vls-plan-guarantee-text">${escapeHtml(guaranteeText)}</span></span>
    </div>
    <a class="vls-plan-cta" href="${escapeHtml(price.ctaUrl || '#')}"><span>${escapeHtml(ctaText)}</span><strong class="vls-plan-cta-price">${currency}${escapeHtml(initialAmount)}</strong><span>→</span></a>
    <div class="vls-plan-checkout">${escapeHtml(checkoutText)}</div>
  </div>
</div><script type="text/javascript">(function(){var root=document.currentScript&&document.currentScript.previousElementSibling;if(!root)return;function txt(el){return el?el.textContent:"";}function update(){var checked=root.querySelector('input[name="vls-plan-choice"]:checked');var opt=checked?checked.closest(".vls-plan-option"):root.querySelector(".vls-plan-option");var price=opt?txt(opt.querySelector(".vls-plan-final")):"";var cta=root.querySelector(".vls-plan-cta-price");if(cta)cta.textContent=price;}root.querySelectorAll('input[name="vls-plan-choice"]').forEach(function(input){input.addEventListener("change",update);});update();})();</script>`;
}

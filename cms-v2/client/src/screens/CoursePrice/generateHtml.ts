import type { CoursePrice } from '../../types/cms';
import { escapeHtml } from '../../utils/text';

export function clampDiscount(value: number): number {
  return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
}

export function money(value: number): string {
  const rounded = Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

export function calculatedPrice(price: CoursePrice): { discount: number; yourPrice: number; saving: number } {
  const regular = Math.max(0, Number(price.regularPrice) || 0);
  const discount = clampDiscount(Number(price.discountPercent) || 0);
  const saving = regular * (discount / 100);
  return {
    discount,
    yourPrice: Math.max(0, regular - saving),
    saving,
  };
}

export function generateCoursePriceHtml(price: CoursePrice): string {
  const { discount, yourPrice, saving } = calculatedPrice(price);
  const currency = escapeHtml(price.currency || '£');
  const regular = money(price.regularPrice);
  const finalPrice = money(yourPrice);
  const saved = money(saving);
  const radius = Math.max(0, Math.min(40, Number(price.radius) || 14));
  const includes = (price.includes || []).filter(Boolean);

  return `<style>
.vls-price-card{box-sizing:border-box;width:100%;max-width:300px;background:${price.bg || '#ffffff'};border:1px solid ${price.border || '#e5e7eb'};border-top:4px solid ${price.accent || '#204280'};border-radius:${radius}px;overflow:hidden;font-family:'Poppins',Arial,sans-serif;color:#111827;box-shadow:0 8px 24px rgba(15,23,42,.08);}
.vls-price-card *{box-sizing:border-box;}
.vls-price-head{padding:18px 20px 16px;border-bottom:1px solid #e5e7eb;}
.vls-price-eyebrow{display:flex;align-items:center;gap:7px;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${price.accent || '#204280'};}
.vls-price-eyebrow:before{content:"";width:5px;height:5px;border-radius:999px;background:${price.accent || '#204280'};}
.vls-price-title{margin-top:6px;font-size:15px;line-height:1.35;font-weight:700;color:#111827;}
.vls-price-body{padding:18px 20px 14px;}
.vls-price-row{display:flex;align-items:center;gap:10px;min-height:22px;}
.vls-price-regular{font-size:15px;color:#374151;text-decoration:line-through;text-decoration-thickness:1.5px;}
.vls-price-discount{display:inline-flex;align-items:center;border:1px solid ${price.saveBorder || '#b7e4c7'};background:${price.discountBg || '#eaf8ef'};color:${price.discountTc || '#057a3d'};font-size:11px;font-weight:800;padding:3px 10px;border-radius:999px;}
.vls-price-label{margin-top:12px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#4b5563;}
.vls-price-final{display:flex;align-items:flex-start;gap:3px;margin-top:4px;color:#102a63;}
.vls-price-currency{font-size:20px;font-weight:800;line-height:1.25;margin-top:8px;}
.vls-price-amount{font-size:46px;font-weight:800;line-height:1;}
.vls-price-save{margin-top:8px;border:1px solid ${price.saveBorder || '#b7e4c7'};background:${price.saveBg || '#f0fbf4'};color:#006b3c;border-radius:6px;padding:7px 11px;font-size:12px;font-weight:600;}
.vls-price-inc-label{margin-top:28px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#4b5563;}
.vls-price-inc{list-style:none;margin:12px 0 0;padding:0;display:grid;gap:11px;}
.vls-price-inc li{display:grid;grid-template-columns:18px 1fr;gap:9px;align-items:start;font-size:13px;line-height:1.35;color:#111827;}
.vls-price-check{display:inline-flex;width:17px;height:17px;border-radius:5px;align-items:center;justify-content:center;background:#eff8ff;border:1px solid #bfdbfe;color:#1d75bd;font-size:11px;line-height:1;}
.vls-price-cta{display:block;margin-top:30px;width:100%;border:1px solid #d1d5db;border-radius:7px;background:#ffffff;color:#111827;text-decoration:none;text-align:center;padding:10px 12px;font-size:14px;font-weight:800;}
.vls-price-refund{margin:10px 0 0;text-align:center;color:#4b5563;font-size:11px;}
@media(max-width:640px){.vls-price-card{max-width:none}.vls-price-amount{font-size:42px}}
</style><div class="vls-price-card">
  <div class="vls-price-head">
    ${price.eyebrow ? `<div class="vls-price-eyebrow">${escapeHtml(price.eyebrow)}</div>` : ''}
    ${price.title ? `<div class="vls-price-title">${escapeHtml(price.title)}</div>` : ''}
  </div>
  <div class="vls-price-body">
    <div class="vls-price-row">
      <span class="vls-price-regular">${currency}${escapeHtml(regular)}</span>
      <span class="vls-price-discount">${escapeHtml(money(discount))}% OFF</span>
    </div>
    <div class="vls-price-label">${escapeHtml(price.priceLabel || 'YOUR PRICE')}</div>
    <div class="vls-price-final"><span class="vls-price-currency">${currency}</span><span class="vls-price-amount">${escapeHtml(finalPrice)}</span></div>
    <div class="vls-price-save">🎉 ${escapeHtml(price.savingPrefix || 'You save')} ${currency}${escapeHtml(saved)} on this course</div>
    ${includes.length ? `<div class="vls-price-inc-label">${escapeHtml(price.includesLabel || 'THIS COURSE INCLUDES')}</div>
    <ul class="vls-price-inc">${includes.map(item => `<li><span class="vls-price-check">✓</span><span>${escapeHtml(item)}</span></li>`).join('')}</ul>` : ''}
    ${price.ctaText ? `<a class="vls-price-cta" href="${escapeHtml(price.ctaUrl || '#')}">${escapeHtml(price.ctaText)}</a>` : ''}
    ${price.refundText ? `<div class="vls-price-refund">${escapeHtml(price.refundText)}</div>` : ''}
  </div>
</div>`;
}

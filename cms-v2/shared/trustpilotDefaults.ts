import { randomUUID } from 'crypto';

/** Default Trustpilot Carousel TrustBox embed for course pages. */
export const DEFAULT_TRUSTPILOT_CAROUSEL_EMBED = `<!-- TrustBox widget - Carousel -->
<div class="trustpilot-widget" data-locale="en-US" data-template-id="53aa8912dec7e10d38f59f36" data-businessunit-id="60077b4c1568c0000152c727" data-style-height="140px" data-style-width="100%" data-token="8638b71f-203f-4dd5-8f73-1939427336f4" data-stars="1,2,3,4,5" data-review-languages="en">
  <a href="https://www.trustpilot.com/review/vls-online.com" target="_blank" rel="noopener">Trustpilot</a>
</div>
<!-- End TrustBox widget -->`;

/** @deprecated Use DEFAULT_TRUSTPILOT_CAROUSEL_EMBED for course pages. */
export const DEFAULT_TRUSTPILOT_GRID_EMBED = DEFAULT_TRUSTPILOT_CAROUSEL_EMBED;

function blokUid(): string {
  return randomUUID().replace(/-/g, '').slice(0, 12);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function buildCourseTestimonialsBlok(embed: string): Record<string, unknown> {
  return {
    _uid: blokUid(),
    component: 'testimonials',
    layout: 'trustpilot',
    trustpilot_embed: embed,
    eyebrow: 'Student reviews',
    title_prefix: 'What students say about their experience with Vertex',
    title_accent: '',
  };
}

function insertIndexBeforeFaqOrPromotion(body: Record<string, unknown>[]): number {
  const anchorIndex = body.findIndex(blok => (
    blok.component === 'faq_section' || blok.component === 'promotion_section'
  ));
  return anchorIndex >= 0 ? anchorIndex : body.length;
}

/**
 * Ensure course_page stories use the carousel Trustpilot widget.
 * Updates existing testimonials bloks and inserts one when missing.
 */
export function patchCourseTrustpilotEmbed(
  content: Record<string, unknown>,
  embed: string = DEFAULT_TRUSTPILOT_CAROUSEL_EMBED,
): boolean {
  if (content.component !== 'course_page') return false;

  const body = Array.isArray(content.body)
    ? content.body.filter(isRecord)
    : [];
  if (!Array.isArray(content.body)) {
    content.body = body;
  }

  const testimonialsIndex = body.findIndex(blok => blok.component === 'testimonials');
  if (testimonialsIndex >= 0) {
    const blok = body[testimonialsIndex];
    const needsUpdate = blok.layout !== 'trustpilot' || blok.trustpilot_embed !== embed;
    if (!needsUpdate) return false;
    blok.layout = 'trustpilot';
    blok.trustpilot_embed = embed;
    return true;
  }

  body.splice(insertIndexBeforeFaqOrPromotion(body), 0, buildCourseTestimonialsBlok(embed));
  content.body = body;
  return true;
}

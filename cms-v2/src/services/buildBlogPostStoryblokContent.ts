import type { ScrapedBlogPost } from '../../shared/migrationTypes';
import {
  collectRichtextImageSources,
  htmlToStoryblokRichtext,
  rewriteRichtextImageSources,
} from './htmlToStoryblokRichtext';
import {
  ensureBlogFolder,
  uploadStoryblokAssetCached,
  type StoryblokConfig,
  type StoryblokUploadedAsset,
} from './storyblokClient';
import { slugifySegment } from '../../shared/migrationDestination';

function blokUid(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}

function storyblokLink(url: string | undefined): Record<string, string> | undefined {
  const trimmed = url?.trim();
  if (!trimmed) return undefined;
  return { linktype: 'url', url: trimmed, cached_url: trimmed };
}

function isUploadableImageSource(source: string): boolean {
  const trimmed = source.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('data:image/')) return true;
  return /^https?:\/\//i.test(trimmed);
}

function isStoryblokAssetUrl(source: string): boolean {
  return /storyblok\.com/i.test(source);
}

function assetFilename(folder: string, slug: string, index: number, sourceUrl: string, alt: string): string {
  const fromUrl = sourceUrl.split('/').pop()?.split('?')[0]?.replace(/\.[a-z0-9]+$/i, '') || '';
  const base = slugifySegment(alt || fromUrl || `image-${index + 1}`) || `image-${index + 1}`;
  return `${folder}/${slug}/${String(index + 1).padStart(2, '0')}-${base}`;
}

async function uploadBlogImage(
  config: StoryblokConfig,
  cache: Map<string, Promise<StoryblokUploadedAsset>>,
  sourceUrl: string,
  filename: string,
  alt: string,
  warnings: string[],
): Promise<StoryblokUploadedAsset | null> {
  if (!isUploadableImageSource(sourceUrl) || isStoryblokAssetUrl(sourceUrl)) {
    return isStoryblokAssetUrl(sourceUrl)
      ? {
          filename: sourceUrl,
          alt,
          name: filename,
          focus: '',
          title: alt,
          copyright: '',
          fieldtype: 'asset',
          meta_data: {},
          is_external_url: false,
        }
      : null;
  }

  try {
    return await uploadStoryblokAssetCached(config, cache, {
      sourceUrl,
      filename,
      alt,
    });
  } catch (error) {
    warnings.push(
      `Could not upload blog image to Storyblok (${sourceUrl}): ${
        error instanceof Error ? error.message : 'unknown error'
      }`,
    );
    return null;
  }
}

function buildStructureContent(scraped: ScrapedBlogPost): Record<string, unknown> {
  return {
    component: 'blog_post',
    title: scraped.title,
    excerpt: scraped.excerpt,
    topic: scraped.topic,
    tags: scraped.tags,
    featured_image: null,
    publish_date: scraped.publishDate || '',
    reading_time: scraped.readingTimeMinutes ?? '',
    key_takeaways: [],
    body: { type: 'doc', content: [{ type: 'paragraph' }] },
    faq_items: [],
    sidebar_cta_heading: scraped.sidebarCta?.heading || 'Ready to qualify online?',
    sidebar_cta_text: scraped.sidebarCta?.text
      || 'Get full access to expert-led ACCA & CIMA exam preparation with live tutor support.',
    sidebar_cta_label: scraped.sidebarCta?.label || 'Explore Full Access',
    sidebar_cta_link: storyblokLink(scraped.sidebarCta?.link || '/courses'),
    mid_cta_heading: scraped.midCta?.heading || 'Formalize your path with Full Access',
    mid_cta_text: scraped.midCta?.text
      || 'Structured, exam-focused preparation with live tutor support across ACCA and CIMA — built to secure your success from the start.',
    mid_cta_label: scraped.midCta?.label || 'Get Full Access',
    mid_cta_link: storyblokLink(scraped.midCta?.link || '/courses'),
    seo: [{
      _uid: blokUid(),
      component: 'seo',
      title: scraped.metaTitle || scraped.title,
      description: scraped.metaDescription || scraped.excerpt,
    }],
  };
}

export function buildBlogPostStructureContent(scraped: ScrapedBlogPost): Record<string, unknown> {
  return buildStructureContent(scraped);
}

export async function buildBlogPostStoryblokContent(
  scraped: ScrapedBlogPost,
  config: StoryblokConfig,
): Promise<{ content: Record<string, unknown>; warnings: string[]; parentFolderId: number }> {
  const warnings: string[] = [];
  const cache = new Map<string, Promise<StoryblokUploadedAsset>>();
  const folder = await ensureBlogFolder(config);
  const slug = scraped.slug || slugifySegment(scraped.title) || 'post';

  const imageUrls = new Map<string, { alt: string; preferredName: string }>();
  for (const [index, image] of scraped.images.entries()) {
    if (!image.sourceUrl || imageUrls.has(image.sourceUrl)) continue;
    imageUrls.set(image.sourceUrl, {
      alt: image.alt || scraped.title,
      preferredName: assetFilename('blog', slug, index, image.sourceUrl, image.alt || scraped.title),
    });
  }
  if (scraped.featuredImageUrl && !imageUrls.has(scraped.featuredImageUrl)) {
    imageUrls.set(scraped.featuredImageUrl, {
      alt: scraped.title,
      preferredName: assetFilename('blog', slug, 0, scraped.featuredImageUrl, scraped.title),
    });
  }

  // Ensure every <img> in body HTML is also queued for upload.
  const bodyDocDraft = htmlToStoryblokRichtext(scraped.bodyHtml);
  for (const [index, src] of collectRichtextImageSources(bodyDocDraft).entries()) {
    if (!imageUrls.has(src)) {
      imageUrls.set(src, {
        alt: scraped.title,
        preferredName: assetFilename('blog', slug, imageUrls.size + index, src, scraped.title),
      });
    }
  }

  const uploadedBySource = new Map<string, StoryblokUploadedAsset>();
  let uploadIndex = 0;
  for (const [sourceUrl, meta] of imageUrls.entries()) {
    const asset = await uploadBlogImage(
      config,
      cache,
      sourceUrl,
      meta.preferredName || assetFilename('blog', slug, uploadIndex, sourceUrl, meta.alt),
      meta.alt,
      warnings,
    );
    uploadIndex += 1;
    if (asset) uploadedBySource.set(sourceUrl, asset);
  }

  const replacements = new Map<string, { src: string; id?: number; alt?: string }>();
  for (const [sourceUrl, asset] of uploadedBySource.entries()) {
    replacements.set(sourceUrl, {
      src: asset.filename,
      id: asset.id,
      alt: asset.alt || scraped.title,
    });
  }

  const body = rewriteRichtextImageSources(bodyDocDraft, replacements);
  const featuredAsset = scraped.featuredImageUrl
    ? uploadedBySource.get(scraped.featuredImageUrl) || null
    : null;

  if (scraped.featuredImageUrl && !featuredAsset) {
    warnings.push('Featured image could not be uploaded to Storyblok — set it manually on the story.');
  }

  const missingInline = collectRichtextImageSources(bodyDocDraft)
    .filter(src => !uploadedBySource.has(src) && !isStoryblokAssetUrl(src));
  if (missingInline.length) {
    warnings.push(
      `${missingInline.length} inline image(s) could not be uploaded and were left on their original URLs or dropped.`,
    );
  }

  const content: Record<string, unknown> = {
    ...buildStructureContent(scraped),
    featured_image: featuredAsset,
    key_takeaways: scraped.keyTakeaways.map(text => ({
      _uid: blokUid(),
      component: 'blog_takeaway_item',
      text,
    })),
    body,
    faq_items: scraped.faqItems.map(item => ({
      _uid: blokUid(),
      component: 'blog_faq_item',
      question: item.question,
      answer: item.answerText || item.answerHtml,
    })),
    seo: [{
      _uid: blokUid(),
      component: 'seo',
      title: scraped.metaTitle || scraped.title,
      description: scraped.metaDescription || scraped.excerpt,
      og_image: featuredAsset || undefined,
    }],
  };

  return {
    content,
    warnings,
    parentFolderId: folder.id,
  };
}

import fs from 'fs';
import path from 'path';
import type { PageContentFileSummary } from '../../shared/migrationTypes';

const PAGE_CONTENT_DIR = path.resolve(__dirname, '../../../page-content');

function stripTags(value: string): string {
  return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function firstMatch(html: string, pattern: RegExp): string {
  const match = html.match(pattern);
  return match ? stripTags(match[1]) : '';
}

export function getPageContentDirectory(): string {
  return PAGE_CONTENT_DIR;
}

export function listPageContentFiles(): PageContentFileSummary[] {
  if (!fs.existsSync(PAGE_CONTENT_DIR)) return [];

  return fs.readdirSync(PAGE_CONTENT_DIR)
    .filter(name => name.endsWith('.html'))
    .sort((a, b) => a.localeCompare(b))
    .map(filename => summarizePageContentFile(filename));
}

export function summarizePageContentFile(filename: string): PageContentFileSummary {
  const filePath = path.join(PAGE_CONTENT_DIR, filename);
  const html = fs.readFileSync(filePath, 'utf8');
  const slug = filename.replace(/\.html$/i, '');
  const title = firstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i)
    .replace(/\s*[—–-]\s*Vertex Learning Solutions.*$/i, '')
    .trim();
  const canonicalUrl = firstMatch(html, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)
    || firstMatch(html, /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i)
    || `https://vls-online.com/${slug}`;

  return {
    filename,
    slug,
    title: title || slug,
    canonicalUrl,
  };
}

export function readPageContentFile(filename: string): { html: string; summary: PageContentFileSummary } {
  const safeName = path.basename(filename);
  if (!safeName.endsWith('.html')) {
    throw new Error('Page content file must be an .html file');
  }

  const filePath = path.join(PAGE_CONTENT_DIR, safeName);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Page content file not found: ${safeName}`);
  }

  return {
    html: fs.readFileSync(filePath, 'utf8'),
    summary: summarizePageContentFile(safeName),
  };
}

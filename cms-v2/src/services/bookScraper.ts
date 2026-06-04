import type { ScrapedBook } from '../../shared/types';
import fs from 'fs';

const BOOKS_URL = 'https://vls-online.com/bppbooks';

type BrowserModule = typeof import('puppeteer-core');
type Chromium = typeof import('@sparticuz/chromium');

function normalizePrice(value: unknown): number {
  const amount = String(value ?? '').replace(/,/g, '').match(/\d+(?:\.\d{1,2})?/);
  return amount ? Number(amount[0]) : 0;
}

function normalizeBook(book: ScrapedBook): ScrapedBook | null {
  const title = book.title.replace(/\s+/g, ' ').trim();
  if (!title || title.length < 3) return null;
  const price = normalizePrice(book.price);
  if (!price) return null;

  const discounted = book.discountedPrice != null ? normalizePrice(book.discountedPrice) : null;
  const description = book.description
    .replace(/\b(Standard Price|Discounted Price|Now)\s*:?\s*/gi, ' ')
    .replace(/\s+([,.])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    title,
    description,
    imageUrl: book.imageUrl.trim(),
    imageAltText: book.imageAltText.replace(/\s+/g, ' ').trim(),
    price,
    discountedPrice: discounted && discounted > 0 ? discounted : null,
    currency: book.currency || 'GBP',
    stripeUrl: book.stripeUrl.trim(),
    sourceUrl: book.sourceUrl || BOOKS_URL,
  };
}

async function executablePath(chromium: Chromium): Promise<string | undefined> {
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    process.platform === 'win32' ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' : '',
    process.platform === 'win32' ? 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe' : '',
    process.platform === 'win32' ? 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe' : '',
    process.platform === 'win32' ? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe' : '',
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  const path = await chromium.executablePath();
  return path && fs.existsSync(path) ? path : undefined;
}

export async function scrapeBppBooks(): Promise<ScrapedBook[]> {
  const [puppeteer, chromiumModule] = await Promise.all([
    import('puppeteer-core') as Promise<BrowserModule>,
    import('@sparticuz/chromium'),
  ]);
  const chromium = (
    (chromiumModule as unknown as { default?: Chromium }).default
    ?? (chromiumModule as unknown as Chromium)
  );

  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: { width: 1440, height: 1600 },
    executablePath: await executablePath(chromium),
    headless: true,
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent('VLS-CMS-BookSync/1.0 (+https://vls-online.com)');
    await page.goto(BOOKS_URL, { waitUntil: 'networkidle2', timeout: 45000 });
    await page.waitForFunction(
      () => document.body.innerText.includes('ACCA') && /(?:£|\$|€)\s?\d/.test(document.body.innerText),
      { timeout: 30000 },
    ).catch(() => undefined);

    const scraped = await page.evaluate((sourceUrl) => {
      type Candidate = {
        title: string;
        description: string;
        imageUrl: string;
        imageAltText: string;
        price: number;
        discountedPrice: number | null;
        currency: string;
        stripeUrl: string;
        sourceUrl: string;
      };

      const priceRe = /(?:£|\$|€)\s?\d{1,5}(?:,\d{3})*(?:\.\d{1,2})?|\b(?:GBP|USD|EUR)\s?\d{1,5}(?:,\d{3})*(?:\.\d{1,2})?/gi;
      const clean = (value: string | null | undefined) => String(value || '').replace(/\s+/g, ' ').trim();
      const absolute = (value: string | null | undefined) => {
        if (!value) return '';
        try {
          return new URL(value, window.location.href).href;
        } catch {
          return '';
        }
      };
      const visible = (node: Element) => {
        const rect = node.getBoundingClientRect();
        const style = window.getComputedStyle(node);
        return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
      };
      const parseAmount = (token: string) => {
        const match = token.replace(/,/g, '').match(/\d+(?:\.\d{1,2})?/);
        return match ? Number(match[0]) : 0;
      };
      const currencyFrom = (text: string) => {
        const upper = text.toUpperCase();
        if (text.includes('$') || upper.includes('USD')) return 'USD';
        if (text.includes('€') || upper.includes('EUR')) return 'EUR';
        return 'GBP';
      };
      const titleFrom = (root: Element, img: HTMLImageElement) => {
        const heading = root.querySelector('h1,h2,h3,h4,h5,h6,[class*="title" i],[class*="name" i],strong,b');
        const headingText = clean(heading?.textContent);
        if (headingText && !priceRe.test(headingText)) return headingText;
        priceRe.lastIndex = 0;
        const imgText = clean(img.alt || img.title || img.getAttribute('aria-label'));
        if (imgText) return imgText;
        return clean(root.textContent).split(/(?:£|\$|€|\bGBP\b|\bUSD\b|\bEUR\b)/i)[0].trim();
      };
      const stripeFrom = (root: Element) => {
        const links = Array.from(root.querySelectorAll<HTMLAnchorElement>('a[href]'));
        const preferred = links.find(a => /stripe|checkout|payment|buy/i.test(a.href));
        return absolute((preferred || links[0])?.getAttribute('href'));
      };
      const smallestBookRoot = (img: HTMLImageElement) => {
        let current: Element | null = img;
        let best: Element | null = null;
        while (current && current !== document.body) {
          const text = clean(current.textContent);
          priceRe.lastIndex = 0;
          if (text.length > 20 && text.length < 2500 && priceRe.test(text)) {
            best = current;
            if (/card|product|book|item|column|col-|pricing/i.test(current.className.toString())) break;
          }
          current = current.parentElement;
        }
        return best;
      };

      const results: Candidate[] = [];
      for (const img of Array.from(document.querySelectorAll<HTMLImageElement>('img'))) {
        if (!visible(img)) continue;
        const root = smallestBookRoot(img);
        if (!root || !visible(root)) continue;
        const text = clean(root.textContent);
        const tokens = text.match(priceRe) || [];
        const amounts = Array.from(new Set(tokens.map(parseAmount).filter(amount => amount > 0 && amount < 10000))).sort((a, b) => b - a);
        if (!amounts.length) continue;

        const title = titleFrom(root, img);
        const stripeUrl = stripeFrom(root);
        const description = text
          .replace(title, '')
          .replace(/\b(Standard Price|Discounted Price|Now)\s*:?\s*/gi, ' ')
          .replace(priceRe, ' ')
          .replace(/\b(buy|purchase|checkout|add to cart|view|learn more)\b/gi, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        results.push({
          title,
          description,
          imageUrl: absolute(img.currentSrc || img.src || img.getAttribute('data-src')),
          imageAltText: clean(img.alt || img.title || img.getAttribute('aria-label')),
          price: amounts[0],
          discountedPrice: amounts.length > 1 ? amounts[amounts.length - 1] : null,
          currency: currencyFrom(tokens.join(' ')),
          stripeUrl,
          sourceUrl,
        });
      }

      const unique = new Map<string, Candidate>();
      for (const item of results) {
        const key = `${item.title.toLowerCase()}|${item.stripeUrl || item.imageUrl}`;
        if (!unique.has(key)) unique.set(key, item);
      }
      return Array.from(unique.values());
    }, BOOKS_URL);

    return scraped
      .map(normalizeBook)
      .filter((book): book is ScrapedBook => Boolean(book));
  } finally {
    await browser.close();
  }
}

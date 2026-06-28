import { readFileSync } from 'fs';
import { join } from 'path';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).send('Method not allowed');

  try {
    const script = readFileSync(
      join(process.cwd(), 'cms-v2/src/assets/course-finder-banner.runtime.js'),
      'utf8',
    );
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    return res.status(200).send(script);
  } catch (err) {
    console.error('[course-finder-banner-runtime]', err);
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    return res.status(500).send('/* VLS course finder banner runtime unavailable */');
  }
}

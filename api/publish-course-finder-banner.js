// Public endpoint — returns course finder banner data for Zenler embed scripts
// No auth required; must allow any origin (fetched from Zenler/external pages)

import { neon } from '@neondatabase/serverless';

const CONFIG_KEY = 'vls-course-finder-banner-config';

function publicCourseUrl(zenlerUrl, slug) {
  const raw = zenlerUrl || (slug ? `/courses/${slug}` : '#');
  return String(raw).replace('https://vls.newzenler.com', 'https://vls-online.com');
}

function mapCourseRow(row) {
  const courseLevels = Array.isArray(row.course_levels)
    ? row.course_levels.filter(Boolean)
    : (row.course_level ? [row.course_level] : []);

  return {
    id: row.id,
    name: row.name,
    slug: row.slug || '',
    category: row.category || '',
    level: row.level || '',
    status: row.status || '',
    url: publicCourseUrl(row.zenler_url, row.slug),
    sortOrder: row.sort_order || 0,
    qualification: row.qualification || '',
    courseLevel: row.course_level || '',
    courseLevels,
    courseOption: row.course_option || '',
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('[publish-course-finder-banner] DATABASE_URL is not set');
    return res.status(500).json({ courses: [], config: null });
  }

  try {
    const sql = neon(dbUrl);
    const [courseRows, configRows] = await Promise.all([
      sql`
        SELECT c.id, c.name, c.slug, c.category, c.level, c.status, c.zenler_url,
               c.sort_order, c.qualification, c.course_level, c.course_option,
               COALESCE(
                 array_remove(array_agg(cl.level ORDER BY cl.sort_order ASC, cl.level ASC), NULL),
                 ARRAY[]::text[]
               ) AS course_levels
        FROM courses c
        LEFT JOIN course_levels cl ON cl.course_id = c.id
        WHERE c.is_active = true
        GROUP BY c.id
        ORDER BY c.sort_order ASC, c.name ASC
      `,
      sql`
        SELECT data FROM cms_content WHERE key = ${CONFIG_KEY} LIMIT 1
      `,
    ]);

    const courses = (courseRows || [])
      .filter(row => row && row.name)
      .map(mapCourseRow);
    const config = configRows[0]?.data && typeof configRows[0].data === 'object'
      ? configRows[0].data
      : null;

    return res.status(200).json({ courses, config });
  } catch (err) {
    console.error('[publish-course-finder-banner]', err);
    return res.status(500).json({ courses: [], config: null });
  }
}

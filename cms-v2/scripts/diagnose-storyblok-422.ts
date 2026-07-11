import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../vls-online-v2/vls-web/.env.local') });

const spaceId = '293626385802926';
const token = process.env.STORYBLOK_PERSONAL_TOKEN ?? process.env.STORYBLOK_TOKEN ?? '';
const region = process.env.STORYBLOK_REGION === 'us' ? 'api-us' : 'mapi';

async function main() {
  if (!token) throw new Error('No Storyblok token in env');

  const base = `https://${region}.storyblok.com/v1/spaces/${spaceId}`;

  const pageRes = await fetch(`${base}/components/page`, {
    headers: { Authorization: token, 'Content-Type': 'application/json' },
  });
  const pagePayload = await pageRes.json();
  if (!pageRes.ok) {
    console.error('Failed to fetch page component', pageRes.status, pagePayload);
    process.exit(1);
  }

  const bodyField = pagePayload.component?.schema?.body;
  const whitelist: string[] = bodyField?.component_whitelist ?? [];
  const required = ['page_hero', 'team_profiles', 'icon_card_grid', 'quote_block', 'promotion_section'];
  const missing = required.filter(name => !whitelist.includes(name));

  console.log('Page body whitelist count:', whitelist.length);
  console.log('Missing for Team VLS migrate:', missing.length ? missing.join(', ') : '(none)');

  for (const name of required) {
    const res = await fetch(`${base}/components/${name}`, {
      headers: { Authorization: token, 'Content-Type': 'application/json' },
    });
    console.log(`Component ${name}:`, res.ok ? 'exists' : `MISSING (${res.status})`);
  }

  // Try minimal story upsert to capture validation details
  const testSlug = 'migration-debug-test-delete-me';
  const content = {
    component: 'page',
    body: [{
      _uid: 'debughero001',
      component: 'page_hero',
      heading_prefix: 'Test',
      lead: 'Test lead',
      primary_cta_text: 'Learn more',
    }],
  };

  const existingRes = await fetch(`${base}/stories?with_slug=${encodeURIComponent(testSlug)}`, {
    headers: { Authorization: token },
  });
  const existingPayload = await existingRes.json();
  const existingId = existingPayload.stories?.[0]?.id;

  const upsertRes = await fetch(`${base}/stories${existingId ? `/${existingId}` : ''}`, {
    method: existingId ? 'PUT' : 'POST',
    headers: { Authorization: token, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      story: { name: 'Migration Debug', slug: testSlug, content },
      publish: 0,
    }),
  });
  const upsertPayload = await upsertRes.json();
  console.log('Test upsert status:', upsertRes.status);
  if (!upsertRes.ok) {
    console.log('Validation details:', JSON.stringify(upsertPayload, null, 2));
  } else {
    console.log('Test upsert OK — page_hero is allowed');
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

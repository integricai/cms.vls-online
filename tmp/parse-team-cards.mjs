import fs from 'node:fs';
const h = fs.readFileSync('c:/GIT/vls/cms.vls-online/tmp/teamvls-live.html', 'utf8');
const uid = h.match(/class="(vlsteam[a-z0-9]+)"/i)?.[1];
console.log('uid', uid);
if (!uid) process.exit(0);
const cards = [...h.matchAll(new RegExp(`<div class="${uid}-card">([\\s\\S]*?)</div>\\s*</div>\\s*(?=<div class="${uid}-card"|</div>\\s*<style)`, 'gi'))];
console.log('cards', cards.length);
for (const [i, m] of cards.entries()) {
  const block = m[1];
  const name = block.match(new RegExp(`class="${uid}-name"[^>]*>([^<]+)`, 'i'))?.[1]?.trim();
  const role = block.match(new RegExp(`class="${uid}-role"[^>]*>([^<]+)`, 'i'))?.[1]?.trim();
  const photo = block.match(new RegExp(`class="${uid}-photo"[^>]*src="([^"]+)"`, 'i'))?.[1];
  const initials = block.match(new RegExp(`class="${uid}-initials"[^>]*>[\\s\\S]*?<span>([^<]+)`, 'i'))?.[1]?.trim();
  console.log({ i, name, role, initials, photoKind: photo?.slice(0, 30), photoLen: photo?.length });
}

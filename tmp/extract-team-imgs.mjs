import fs from 'node:fs';
const h = fs.readFileSync('c:/GIT/vls/cms.vls-online/tmp/teamvls-live.html', 'utf8');
const imgs = [...h.matchAll(/class="vlsteam[a-z0-9]+-photo"[^>]*src="([^"]+)"/gi)];
console.log('photos:', imgs.map(m => m[1]));
const names = [...h.matchAll(/class="vlsteam[a-z0-9]+-name"[^>]*>([^<]+)/gi)];
console.log('names:', names.map(m => m[1].trim()));

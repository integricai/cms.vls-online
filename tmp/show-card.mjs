import fs from 'node:fs';
const h = fs.readFileSync('c:/GIT/vls/cms.vls-online/tmp/teamvls-live.html', 'utf8');
const uid = 'vlsteamr4rgh';
const compact = h.replace(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/g, '[BASE64]');
const first = compact.match(new RegExp(`<div class="${uid}-card">([\\s\\S]*?)</div>\\s*</div>\\s*(?=<div class="${uid}-card")`))?.[1];
console.log(first);

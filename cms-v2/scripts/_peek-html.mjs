import fs from 'fs';

const file = process.argv[2];
const html = fs.readFileSync(file, 'utf8');
const plhm = html.match(/<div id="plhm[^"]+"[\s\S]*?<!-- Hero Banner V2 Section ends here -->/i)?.[0]
  ?? html.match(/<div class="vlsd9exx-wrap"[\s\S]*?<!-- Hero Banner V2 Section ends here -->/i)?.[0];
console.log(plhm?.slice(0, 4000) ?? 'not found');

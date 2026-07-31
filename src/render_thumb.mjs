// f0 썸네일 후보 3안 렌더 + **200px 판독 대조 시트**.
// 쇼츠 피드에서 썸네일이 실제로 차지하는 폭이 200px 대라, 원본 크기로만 보면 판정이 안 된다.
// 사용: node render_thumb.mjs
import { pathToFileURL } from 'url';
import path from 'path'; import fs from 'fs';
import { spawnSync } from 'child_process';
import { launch, here } from './browser.mjs';

const HERE = here(import.meta.url);
const b = await launch(HERE);
const pg = await b.newPage({ viewport:{width:1080,height:1920}, deviceScaleFactor:1 });
pg.on('pageerror', e => console.log('PAGEERR', e.message));
await pg.goto(pathToFileURL(path.join(HERE,'thumb.html')).href, { waitUntil:'load' });
await pg.waitForFunction('window.__ready === true', null, { timeout:180000 });

const VS = await pg.evaluate(() => window.__variants);
const dir = path.join(HERE,'thumb'); fs.mkdirSync(dir,{recursive:true});
const cv = await pg.$('#cv');
for (const v of VS){
  await pg.evaluate(x => window.__drawThumb(x), v);
  await cv.screenshot({ path: path.join(dir, `f0_${v}.png`) });
  console.log('thumb', v);
}
await b.close();

// 위 = 300px 축소 / 아래 = **실사용 200px**. 판정은 아래 줄로 한다.
const args = ['-nostdin','-v','error','-y'];
VS.forEach(v => args.push('-i', path.join(dir, `f0_${v}.png`)));
const n = VS.length;
const f = VS.map((_,i) => `[${i}:v]scale=300:-1[a${i}]`).join(';') + ';'
        + VS.map((_,i) => `[${i}:v]scale=200:-1,pad=300:ih:50:0:color=black[b${i}]`).join(';') + ';'
        + VS.map((_,i) => `[a${i}]`).join('') + VS.map((_,i) => `[b${i}]`).join('')
        + `xstack=inputs=${n*2}:fill=black:layout=`
        + [...VS.map((_,i) => `${i*300}_0`), ...VS.map((_,i) => `${i*300}_h0`)].join('|') + '[o]';
args.push('-filter_complex', f, '-map','[o]', path.join(HERE,'thumb_sheet.png'));
const r = spawnSync('ffmpeg', args, { windowsHide:true });
console.log(r.status === 0 ? '→ thumb_sheet.png (위=300px · 아래=실사용 200px)' : String(r.stderr).slice(-600));

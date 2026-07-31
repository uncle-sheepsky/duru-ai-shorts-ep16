// G6 전용 렌더 — 상시 모션을 고정한 상태로 컴프별 전 프레임을 _hold/ 에 굽는다.
// 판정은 hold_report.py 가 한다(여기선 굽기만).
// 사용: node hold_gate.mjs
import { pathToFileURL } from 'url';
import path from 'path'; import fs from 'fs';
import { launch, here } from './browser.mjs';

const HERE = here(import.meta.url);

const b = await launch(HERE);
const pg = await b.newPage({ viewport:{width:1080,height:1920}, deviceScaleFactor:1 });
pg.on('pageerror', e => console.log('PAGEERR', e.message));
await pg.goto(pathToFileURL(path.join(HERE,'hold_gate.html')).href, { waitUntil:'load' });
await pg.waitForFunction('window.__ready === true', null, { timeout:180000 });

const COMP = await pg.evaluate(()=>window.__comp);
const OUT = path.join(HERE,'_hold');
fs.rmSync(OUT, { recursive:true, force:true });
fs.mkdirSync(OUT, { recursive:true });
const cv = await pg.$('#cv');
for (let k = 0; k < COMP.length; k++){
  const dir = path.join(OUT, `c${String(k).padStart(2,'0')}`);
  fs.mkdirSync(dir, { recursive:true });
  for (let lf = 0; lf < COMP[k].len; lf++){
    await pg.evaluate(([kk,ll]) => window.__drawHold(kk,ll), [k, lf]);
    await cv.screenshot({ path: path.join(dir, `l${String(lf).padStart(3,'0')}.png`) });
  }
  console.log(`C${k} ${COMP[k].len}f`);
}
await b.close();
console.log('→ _hold/  (hold_report.py 로 판정)');

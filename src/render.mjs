// ep16 유입 숏폼 결정론 렌더 + 게이트. 1080×1920 @25fps · 550f = 22.000s · 12 comp(C0~C11).
// 경로독립: .akashic-root 상향탐색.
// 사용: node render.mjs            대표 프레임 + 결정론 역순 재시크 게이트
//       node render.mjs --all      전 프레임 → frames/
//       node render.mjs --contact  12 comp 대표 프레임 컨택트 시트(세이프존 오버레이)
//       node render.mjs --spots f,f,f   임의 프레임만 → _spot/
import { pathToFileURL } from 'url';
import path from 'path'; import fs from 'fs'; import crypto from 'crypto';
import { spawnSync } from 'child_process';
import { launch, here } from './browser.mjs';

const HERE = here(import.meta.url);

// ★code_data.js 스테일 검사 — beats16.js/comp.html 을 고치면 줄번호가 밀린다.
//   화면이 「원문 32줄」이라고 말하는데 원문이 바뀌어 있으면 그 순간 화면이 거짓이 된다.
{
  const h = crypto.createHash('sha256');
  for (const f of ['beats16.js','comp.html']) h.update(fs.readFileSync(path.join(HERE,f)));
  const want = h.digest('hex').slice(0,12);
  const cd = fs.readFileSync(path.join(HERE,'code_data.js'),'utf8');
  const got = (cd.match(/SRC_SHA = ([0-9a-f]{12})/) || [])[1];
  if (got !== want)
    throw new Error(`★code_data.js 스테일 (원문 ${want} ≠ 각인 ${got}) — build_codedata.py 를 다시 돌려라`);
  console.log(`code_data.js 대조 PASS  SRC_SHA=${want}`);
}

// ★ffmpeg rawvideo 로 픽셀 SHA — 이 환경 node_modules 에 pngjs 가 없다.
function rawRgbSha(file){
  const r = spawnSync('ffmpeg', ['-nostdin','-v','error','-i',file,'-f','rawvideo','-pix_fmt','rgb24','-'],
    { windowsHide:true, maxBuffer: 1<<28 });
  if (r.status !== 0) throw new Error(`ffmpeg raw failed\n${r.stderr}`);
  return crypto.createHash('sha256').update(r.stdout).digest('hex').slice(0,12);
}

const OUT = path.join(HERE,'frames');
const ALL     = process.argv.includes('--all');
const CONTACT = process.argv.includes('--contact');
const SPOTARG = (process.argv.find(a => a.startsWith('--spots=')) || '').slice(8);


const b = await launch(HERE);
const pg = await b.newPage({ viewport:{width:1080,height:1920}, deviceScaleFactor:1 });
pg.on('console', m => { if (m.type()==='error') console.log('ERR', m.text()); });
pg.on('pageerror', e => console.log('PAGEERR', e.message));
await pg.goto(pathToFileURL(path.join(HERE,'comp.html')).href, { waitUntil:'load' });
await pg.waitForFunction('window.__ready === true', null, { timeout:180000 });

const FPS  = await pg.evaluate(()=>window.__fps);
const N    = await pg.evaluate(()=>window.__frames);
const TOT  = await pg.evaluate(()=>window.__total);
const NB   = await pg.evaluate(()=>window.__beats);
const COMP = await pg.evaluate(()=>window.__comp);
const WSHA = await pg.evaluate(()=>window.__wordsSha);
const CSHA = await pg.evaluate(()=>window.__codeSha);
if (Math.round(TOT*FPS) !== N) throw new Error(`격자 불일치 ${TOT*FPS} vs ${N}`);
fs.mkdirSync(OUT,{recursive:true});
const cv = await pg.$('#cv');

if (SPOTARG) {
  const dir = path.join(HERE,'_spot'); fs.mkdirSync(dir,{recursive:true});
  for (const s of SPOTARG.split(',')){
    const f = parseInt(s,10);
    await pg.evaluate(t=>window.__seekTo(t), f/FPS);
    await cv.screenshot({ path: path.join(dir,`f${String(f).padStart(4,'0')}.png`) });
  }
  console.log('_spot/ 완료', SPOTARG);
} else if (CONTACT) {
  const dir = path.join(HERE,'_contact'); fs.mkdirSync(dir,{recursive:true});
  const shots = [];
  const LF = parseInt((process.argv.find(a=>a.startsWith('--lf=' ))||'--lf=20').slice(5),10);
  for (let k=0; k<NB; k++){
    const f = COMP[k].f0 + Math.min(LF, COMP[k].len-1);
    await pg.evaluate(t=>window.__seekTo(t), f/FPS);
    await pg.evaluate(label => {           // 세이프존 오버레이(게이트 전용 · 본편 렌더에는 없다)
      const g = document.getElementById('cv').getContext('2d');
      const S = window.BEATS.SAFE;
      g.save(); g.strokeStyle='rgba(224,87,79,.85)'; g.lineWidth=3; g.setLineDash([14,10]);
      g.strokeRect(S.x0,S.y0,S.x1-S.x0,S.y1-S.y0);
      g.setLineDash([]); g.strokeStyle='rgba(241,207,102,.7)'; g.lineWidth=2;
      g.beginPath(); g.moveTo(0,1700); g.lineTo(1080,1700); g.stroke();   // G5 대역
      g.fillStyle='rgba(224,87,79,.95)'; g.fillRect(0,1824,420,96);
      g.fillStyle='#090c0d'; g.font='700 46px monospace'; g.textBaseline='middle';
      g.fillText(label, 24, 1872);
      g.restore();
    }, `C${String(k).padStart(2,'0')} f${f}`);
    const p = path.join(dir, `c${String(k).padStart(2,'0')}.png`);
    await cv.screenshot({ path:p }); shots.push(p);
  }
  const args = ['-nostdin','-v','error','-y'];
  shots.forEach(f => args.push('-i', f));
  const simple = shots.map((_,i)=>`[${i}:v]scale=300:-1[s${i}]`).join(';');
  const cat = shots.map((_,i)=>`[s${i}]`).join('');
  const layout = shots.map((_,i)=>{
    const c=i%6, r=Math.floor(i/6);
    return `${c*300}_${r===0?'0':'h0'}`;
  }).join('|');
  args.push('-filter_complex', `${simple};${cat}xstack=inputs=${shots.length}:fill=black:layout=${layout}[o]`,
            '-map','[o]', path.join(HERE, `contact_sheet_lf${LF}.png`));
  const r = spawnSync('ffmpeg', args, { windowsHide:true });
  if (r.status !== 0) console.log('contact fail', String(r.stderr).slice(-700));
  else console.log(`contact_sheet_lf${LF}.png (12 comp · 세이프존 + G5 대역 오버레이)`);
} else if (ALL) {
  for (let f=0; f<N; f++){
    await pg.evaluate(t=>window.__seekTo(t), f/FPS);
    await cv.screenshot({ path: path.join(OUT,`f${String(f).padStart(4,'0')}.png`) });
    if (f%50===0) console.log('frame', f, '/', N);
  }
  console.log('FRAMES DONE', N);
} else {
  // 컴프 경계 전부 + 각 컴프 중앙 + 말미. comp 가 바뀌는 프레임이 최대 위험 지점이다.
  const SPOTS = [];
  for (const c of COMP){ SPOTS.push(c.f0); SPOTS.push(c.f0 + Math.floor(c.len/2)); }
  SPOTS.push(N-1);
  const first = {};
  for (const f of SPOTS){
    await pg.evaluate(t=>window.__seekTo(t), f/FPS);
    const p = path.join(OUT,`s_${String(f).padStart(4,'0')}.png`);
    await cv.screenshot({ path:p }); first[f]=rawRgbSha(p);
  }
  let pass=0;
  for (const f of [...SPOTS].reverse()){
    await pg.evaluate(t=>window.__seekTo(t), f/FPS);
    const p = path.join(OUT,`_chk.png`);
    await cv.screenshot({ path:p });
    if (rawRgbSha(p)===first[f]) pass++;
    else console.log(`  ★MISMATCH f${f}`);
    fs.unlinkSync(p);
  }
  console.log(`결정론 역순 재시크 ${pass}/${SPOTS.length} ${pass===SPOTS.length?'PASS':'★FAIL'}`);
  console.log(`격자 ${TOT}s × ${FPS}fps = ${N}f · ${NB} comp = ${COMP.map(c=>c.len).join('+')}`);
  console.log(`★words_sha = ${WSHA}   ★code SRC_SHA = ${CSHA}`);
}
await b.close();

/* ═══════════════════════════════════════════════════════════════════════════
   ep16 유입 숏폼 — 컴프 라이브러리 (12 comp)

   1080×1920 @25fps CFR · **N=550f=22.000s** · BPM120 · 1마디 50f(2.0s) · **11마디 · 44박**
   컴프 = 박 [4, 2,2,2, 4,4,4, 4,4,4, 4, 6]
   경계 f = 0/50/75/100/125/175/225/275/325/375/425/475
   ★경계가 전부 25f 배수 = **박 위치 반올림 오차 0.0f**(ep15 는 3박 컴프 때문에 ≤0.5f 였다).

   ★격자가 유일해인 이유 — ◆사용자 스펙이 「결과물 3초 3종 / 4초 2종 / 컴프 2초」로
     전부 **1.000초 단위**다. 25fps 에서 1.000초가 정수 박이 되는 템포는 120 계열뿐이고,
     총길이는 정수 마디여야 BGM 이음매가 0 이 된다.
   ★22.000s 인 이유 = ◆후킹 나레(N0 · 발화 2.000s)가 추가되면서 20.000s 로는 자리가 없다.
     BPM120 에서 20 다음 정수 마디는 21 이 아니라 **22.000s(11마디)** 다(R16 — 길이를 바꾸면
     상수·마디해·온셋이 전부 시프트해서 전면 재렌더).

   ★0.5초 후킹 설계 — f0 에 페이드인이 없다. 결과물이 **이미 재생 중인 상태**로 시작하고
     HUD 만 6f 안에 앉는다. ep15 가 랜드스케이프 소스라 창(495×880)에 넣어야 했던 것과 달리
     이 채널 결과물 7편은 **전부 세로 1080×1920**(ffprobe 실측)이라 **풀블리드 무크롭**이 된다.
     후킹 = 면적 × 모션이고, 창은 면적을 버린다.

   ★온스크린 규약(캐넌 · ep14 교정①): **나레가 말하는 문장을 화면 타이포로 재발화 금지.**
     comp 안의 글자는 라벨·파일명·수치·URL 뿐이고, 문장은 아래 CAPTION 워드싱크 트랙이 맡는다.
     타이밍 원천 = narration/nar/words.json (words_sha 916a161b25e1) · 표기만 대본으로 교정.
     ★◆사용자 실녹음 전체 재녹음본(균일 배속 **1.050×** · 라인레벨 **−19.50 LUFS**).

   ★화면에 뜨는 코드는 **이 파일과 comp.html 의 실제 줄**이다(줄번호 포함).
     `build_codedata.py` 가 실행 시점에 원문에서 뽑아 `code_data.js` 로 굽고, 찾지 못하면
     빌드가 실패한다. ⇒ ep15 에서 적발된 「지어낸 줄번호(032~036)」 사고가 구조적으로 불가능하다.

   ★레이아웃 밴드
     head  y  60–160     · 라벨층(스크림 위)
     stage y 176–1400    · 본문
     cap   y 1412–1516   · 워드싱크 자막
     foot  y 1548–1660   · 증거층(도트·미세 라벨)
   ★세이프존(쇼츠 9:16): 의미를 지는 텍스트·CTA 는 x[108,886]·y[154,1536].
     증거층은 x[40,1040]·y[100,1700]. **y>1700 은 플랫폼 UI 대역** — 스크림으로 눌러 둔다(G5).

   ⛔Math.random · Date.now · CSS transition/@keyframes · filter:blur 금지.
     화면 전체가 (comp, lf, gf) 의 순수함수다.
   ═══════════════════════════════════════════════════════════════════════════ */
(() => {
const W = 1080, H = 1920, FPS = 25;
const CB  = [4, 2,2,2, 4,4,4, 4,4,4, 4, 6];   // 컴프별 박. 합 44박 = 11마디
const FPB = 12.5;                          // 1박 = 12.5f (BPM120 @25fps)
const NB  = CB.length;                     // 12 comp
const COMP = [];
{ let b = 0;
  for (let i = 0; i < NB; i++) {
    COMP.push({ b0:b, f0:Math.round(b*FPB), len:0 });
    b += CB[i];
  }
  COMP.forEach((c, i) => {
    c.len = (i+1 < NB ? COMP[i+1].f0 : Math.round(b*FPB)) - c.f0;
  });
}
const N = COMP[NB-1].f0 + COMP[NB-1].len;  // 550f = 22.000s
const compAt = f => { let i = 0; while (i+1 < NB && COMP[i+1].f0 <= f) i++; return i; };
let CURF = 0;                                   // 글로벌 프레임(자기참조 화면용 · f 의 순수 파생값)
// ★게이트 전용 — 상시 모션(결과물 재생·커서 점멸·자기참조 마커)을 고정한다.
//   "화면이 안 변한다"를 재려면 **변해도 되는 것**을 먼저 빼야 한다(ep15 v4 교훈).
//   ⛔본편 렌더는 항상 -1. 이 값이 -1 이 아니면 결정론 게이트를 통과해도 납품본이 아니다.
let FREEZE = -1;
const SAFE = { x0:108, x1:886, y0:154, y1:1536 };
const CAPY = 1464, FOOTY = 1600;

const C = {
  bg:'#090c0d', panel:'#101719', panel2:'#151d1f', line:'#2b393c',
  muted:'#899594', cream:'#eee5d5', cyan:'#27d8c6', orange:'#f3a044',
  pink:'#ec5187', yellow:'#f1cf66', green:'#83d18e', dim:'#536264', red:'#e0574f'
};

let g = null;
const setCtx = ctx => { g = ctx; };

// ── 실물 자산 ────────────────────────────────────────────────────────────────
//  결과물 mp4(게시본)에서 뽑은 프레임. 규격·근거 = assets/works_manifest.json
//  ★수치는 전부 ffprobe 실측이다(창작 0). 「코드로 한 프레임씩 만들었다」의 증거층으로 쓴다.
//  ★배열 순서 = 화면 등장 순서다(C1·C2·C3 → C5 → C6). 진행 도트 인덱스와 어긋나지 않게.

//  ★3연타 순서 = ◆사용자 지정(은하 · 테트리스 · 수박). 나머지 2종이 C5·C6.
const WORKS = [
  { tag:'galaxy', ep:'ep5',  name:'은하 충돌',    frames:880,  secs:'29.33' },
  { tag:'tetris', ep:'ep9',  name:'T-스핀 판정',  frames:1026, secs:'34.20' },
  { tag:'suika',  ep:'ep10', name:'과일 물리',    frames:720,  secs:'24.00' },
  { tag:'rhythm', ep:'ep1',  name:'리듬 게임',    frames:1382, secs:'46.07' },
  { tag:'durufm', ep:'ep13', name:'라디오 HUD',   frames:576,  secs:'19.20' },
];
// C0(후킹) 전용 자산 — WORKS 에 넣지 않는다(진행 도트·타일 개수는 5종 그대로여야 한다).
const HOOKTAG = 'durufm2';
const NBIG = 25, NTINY = 12;
const big = {}, tiny = {};
[...WORKS, { tag:HOOKTAG }].forEach(w => {
  big[w.tag] = []; tiny[w.tag] = [];
  for (let i = 1; i <= NBIG; i++)  { const im = new Image(); im.src = `assets/big/${w.tag}_${String(i).padStart(3,'0')}.png`;  big[w.tag].push(im); }
  for (let i = 1; i <= NTINY; i++) { const im = new Image(); im.src = `assets/tiny/${w.tag}_${String(i).padStart(3,'0')}.png`; tiny[w.tag].push(im); }
});
const allImages = () => [...WORKS.map(w => w.tag), HOOKTAG].flatMap(t => [...big[t], ...tiny[t]]);
const fontsReady = () => Promise.all([
  document.fonts.load('700 40px JetBrains'), document.fonts.load('800 46px Pretendard'),
  document.fonts.load('900 64px PretendardBlack')]).then(() => document.fonts.ready);

// ── 이징·유틸 ────────────────────────────────────────────────────────────────
const clamp = v => Math.max(0, Math.min(1, v));
const seg   = (f,a,b) => clamp((f-a)/(b-a||1));
const eo    = p => 1 - Math.pow(1-clamp(p), 3);
const eio   = p => p < .5 ? 4*p*p*p : 1 - Math.pow(-2*p+2, 3)/2;
const bo    = p => { const c1=1.70158, c3=c1+1, x=clamp(p); return 1 + c3*Math.pow(x-1,3) + c1*Math.pow(x-1,2); };
const lerp  = (a,b,p) => a + (b-a)*p;

function line(x1,y1,x2,y2,c=C.line,w=1,dash=[],a=1){ if(a<=0)return; g.save(); g.globalAlpha=a; g.strokeStyle=c; g.lineWidth=w; g.setLineDash(dash); g.lineCap='round'; g.beginPath(); g.moveTo(x1,y1); g.lineTo(x2,y2); g.stroke(); g.restore(); }
function rrect(x,y,w,h,r=3,fill=null,stroke=C.line,lw=1,a=1){ if(a<=0||w<=0||h<=0)return; g.save(); g.globalAlpha=a; g.beginPath(); g.roundRect(x,y,w,h,r); if(fill){g.fillStyle=fill; g.fill();} if(stroke){g.strokeStyle=stroke; g.lineWidth=lw; g.stroke();} g.restore(); }
function text(v,x,y,s=18,c=C.muted,weight=600,align='left',a=1,fam='JetBrains,monospace'){ if(a<=0||v==null||v==='')return; g.save(); g.globalAlpha=a; g.font=`${weight} ${s}px ${fam}`; g.fillStyle=c; g.textAlign=align; g.textBaseline='middle'; g.fillText(v,x,y); g.restore(); }
function tw(v,s,weight=650,fam='JetBrains,monospace'){ g.save(); g.font=`${weight} ${s}px ${fam}`; const w=g.measureText(v).width; g.restore(); return w; }
function dot(x,y,c,r=5,open=false,a=1){ if(a<=0)return; g.save(); g.globalAlpha=a; g.fillStyle=open?'rgba(9,12,13,.85)':c; g.strokeStyle=c; g.lineWidth=2; g.beginPath(); g.arc(x,y,r,0,Math.PI*2); g.fill(); g.stroke(); g.restore(); }
function bracket(x,y,w,h,c=C.cyan,l=26,a=1,lw=3){ if(a<=0)return; line(x,y,x+l,y,c,lw,[],a); line(x,y,x,y+l,c,lw,[],a); line(x+w-l,y,x+w,y,c,lw,[],a); line(x+w,y,x+w,y+l,c,lw,[],a); line(x,y+h-l,x,y+h,c,lw,[],a); line(x,y+h,x+l,y+h,c,lw,[],a); line(x+w-l,y+h,x+w,y+h,c,lw,[],a); line(x+w,y+h-l,x+w,y+h,c,lw,[],a); }
function gridbg(a=1){ g.fillStyle=C.bg; g.fillRect(0,0,W,H); for(let x=24;x<W;x+=48) line(x,0,x,H,'rgba(70,103,104,.07)',1,[],a); for(let y=24;y<H;y+=48) line(0,y,W,y,'rgba(70,103,104,.07)',1,[],a); }
function cover(im,x,y,w,h,a=1){ if(!im||!im.complete||!im.naturalWidth||a<=0||w<=0||h<=0)return; const s=Math.max(w/im.naturalWidth,h/im.naturalHeight), dw=im.naturalWidth*s, dh=im.naturalHeight*s; g.save(); g.globalAlpha=a; g.beginPath(); g.rect(x,y,w,h); g.clip(); g.drawImage(im,x+(w-dw)/2,y+(h-dh)/2,dw,dh); g.restore(); }
function vgrad(x,y,w,h,stops){ if(h<=0)return; g.save(); const gr=g.createLinearGradient(0,y,0,y+h); stops.forEach(s=>gr.addColorStop(s[0],s[1])); g.fillStyle=gr; g.fillRect(x,y,w,h); g.restore(); }
function caret(x,y,h,f,c=C.yellow,a=1){ if(FREEZE>=0 || Math.floor(f/4)%2===0) rrect(x,y,4,h,0,c,null,0,a); }

// ── 결과물 재생 ──────────────────────────────────────────────────────────────
//  샘플링 12.5fps → idx = floor(lf/2) 로 25fps 실시간(작화 on twos).
//  ★FREEZE 시 인덱스 고정 — 재생은 결함이 아니라 설계이므로 유지시간 지표에서 빼야 한다.
function widx(lf, n){
  if (FREEZE >= 0) return 0;
  return Math.min(n - 1, Math.floor(lf / 2));
}
// ★스케일 펀치 — 컷 순간 1.05배에서 5f 만에 1.00 으로 앉는다. 페이드가 아니라 **타격**이라
//   첫 프레임이 이미 100% 보이면서도 컷이 비트로 읽힌다(0.5초 후킹 · BGM 다운비트와 물린다).
function playFull(tag, lf){
  const s = lerp(1.05, 1.0, eo(seg(lf, 0, 5)));
  const dw = W * s, dh = H * s;
  cover(big[tag][widx(lf, NBIG)], (W-dw)/2, (H-dh)/2, dw, dh, 1);
}
function playTiny(tag, lf, x, y, w, h, a, off){
  const i = FREEZE >= 0 ? off % NTINY : (off + Math.floor(lf / 3)) % NTINY;
  cover(tiny[tag][i], x, y, w, h, a);
}
// 상·하 스크림 — HUD 가독 + G5(플랫폼 UI 대역 y>1700 은 눌러 둔다)
function scrims(a=1){
  vgrad(0,0,W,300,[[0,`rgba(6,9,10,${.92*a})`],[1,'rgba(6,9,10,0)']]);
  vgrad(0,1240,W,680,[[0,'rgba(6,9,10,0)'],[.42,`rgba(6,9,10,${.80*a})`],[1,`rgba(6,9,10,${.985*a})`]]);
}

// ══════════════════════════════════════════════════════════════════════════
//  워드싱크 자막 트랙 — 문장은 오직 여기서만 나온다
//  타이밍 = narration/nar/words.json (words_sha 168b7b6c657e · 손대지 않음)
//  표기만 대본 정본으로 교정: 걸어둘게요→걸어 둘게요 · 전달해보세요→전달해 보세요
// ══════════════════════════════════════════════════════════════════════════
const WORDS_SHA = '916a161b25e1';
const LINES = [
  { id:'N0', start:0, words:[['AI로',0,0.38],['어디까지',0.38,0.74],['할',0.74,0.84],['수',0.84,0.98],['있는지',0.98,1.28],['3초만',1.28,1.66],['봐주세요',1.66,2]],
    clauses:[[0, 5], [5, 7]] },
  { id:'N1', start:134, words:[['이',0,0.08],['화면들',0.08,0.44],['전부',0.44,0.7],['코드로',0.7,1.08],['그렸습니다',1.08,1.52],['여러분도',1.66,2.22],['똑같이',2.22,2.62],['만들',2.62,2.76],['수',2.76,2.98],['있어요',2.98,3.28]],
    clauses:[[0, 5], [5, 10]] },
  { id:'N2', start:284, words:[['고정',0,0.16],['댓글에',0.16,0.5],['링크를',0.5,0.92],['걸어 둘게요',0.92,1.52],['받아서',1.64,1.94],['그대로',1.94,2.2],['AI에',2.2,2.94],['전달해 보세요',2.94,3.52]],
    clauses:[[0, 4], [4, 8]] },
  { id:'N3', start:396, words:[['우선',0,0.28],['지금',0.28,0.64],['보고',0.64,0.88],['있는',0.88,1.08],['이',1.08,1.28],['영상도',1.28,1.84],['말이죠',1.84,2.32]],
    clauses:[[0, 4], [4, 7]] },
];
// ★자막 종료 = 마지막 어절 end. dur(패딩 포함)로 끊으면 다음 컴프로 몇 프레임 샌다.
LINES.forEach(L => { L.end = L.start + Math.ceil(L.words[L.words.length-1][2]*FPS); });

function caption(gf){
  if (FREEZE >= 0) gf = FREEZE;
  const L = LINES.find(l => gf >= l.start && gf < l.end);
  if (!L) return;
  const t = (gf - L.start) / FPS;
  let ci = L.clauses.findIndex(([a,b]) => t >= L.words[a][1] && t < L.words[b-1][2]);
  if (ci < 0) ci = t < L.words[0][1] ? 0 : L.clauses.length - 1;
  const [a,b] = L.clauses[ci];
  const parts = L.words.slice(a,b);
  const S = 46, GAP = 16, FAM = 'Pretendard,sans-serif';
  const widths = parts.map(p => tw(p[0], S, 800, FAM));
  const total = widths.reduce((s,w)=>s+w,0) + GAP*(parts.length-1);
  const cin = eo(seg(t - L.words[a][1], 0, 0.32));
  const y = CAPY + (1-cin)*14;
  rrect(540-total/2-34, y-46, total+68, 92, 8, 'rgba(9,12,13,.78)', 'rgba(83,105,106,.34)', 1, cin*.97);
  let x = 540 - total/2;
  parts.forEach((p,i) => {
    const on = t >= p[1] && t < p[2];
    text(p[0], x, y, S, on ? C.cyan : C.cream, 800, 'left', cin*(on?1:.62), FAM);
    if (on) line(x, y+32, x+widths[i], y+32, C.cyan, 3, [], cin);
    x += widths[i] + GAP;
  });
}

// ══════════════════════════════════════════════════════════════════════════
//  실물 문자열 — 창작 금지
// ══════════════════════════════════════════════════════════════════════════
const K = window.CODE16;               // build_codedata.py 산출. 없으면 즉시 실패시킨다
if (!K) throw new Error('code_data.js 미생성 — build_codedata.py 를 먼저 돌려라');
const URL_PROFILE = 'github.com/uncle-sheepsky';
// ★화면은 **저장소 이름을 말하지 않는다.** 저장소는 아직 만들어지지 않았고(13단계 ◆사용자),
//   화면이 플랫폼 상태를 주장하면 그 순간부터 썩기 시작한다(ep15 `PUBLIC 06` 사고).
//   온스크린으로 갈 수 있는 주소는 **프로필 하나**뿐이고, 저장소 주소는 고정 댓글이 준다.
const PKG    = 'ep16_giveaway';                          // 이 편 소스 패키지 이름(로컬 실물)
const CHAN   = '아낌없이 주는 두루';
// 고정 댓글 본문 첫 줄 — 실제 게시 원고(고정댓글-ep16.md)와 **같은 문자열**이어야 한다
const PIN1   = '이 영상 만든 코드랑 지시문, 전부 올려 뒀어요.';
const BUNDLE = [['README.md','무엇이 들어 있나'], ['PROMPTS.md','STEP 0~6 지시문'],
                ['beats16.js','11 comp 연출'],   ['comp.html','조립 + 시간축']];
const ACC = [C.cyan, C.pink, C.orange, C.green, C.yellow];

// ── 코드 패널 ────────────────────────────────────────────────────────────────
const KW = /^(const|let|var|function|return|if|else|for|while|new|of|in|class|import|export|await|async|=>)$/;
function codeLine(row, x, y, size, a, hi){
  //  row = [줄번호, 원문]. 토크나이저는 결정론(정규식 스캔).
  const [no, src] = row;
  text(String(no).padStart(3,' '), x, y, size-4, hi?C.cyan:'rgba(83,105,106,.85)', 650, 'right', a);
  let cx = x + 22;
  if (/^\s*(\/\/|\*|\/\*)/.test(src)) { text(src.trim(), cx, y, size, 'rgba(131,209,142,.62)', 500, 'left', a); return; }
  const toks = src.replace(/\t/g,'  ').match(/(\s+|'[^']*'|"[^"]*"|`[^`]*`|\/\/.*$|[A-Za-z_$][\w$]*|\d+\.?\d*|.)/g) || [];
  let com = false;
  for (const t of toks){
    if (t.startsWith('//')) com = true;
    const c = com ? 'rgba(131,209,142,.62)'
      : /^['"`]/.test(t) ? C.orange
      : KW.test(t) ? C.pink
      : /^\d/.test(t) ? C.yellow
      : /^[A-Za-z_$]/.test(t) ? (hi ? C.cream : 'rgba(238,229,213,.88)')
      : 'rgba(137,149,148,.92)';
    text(t, cx, y, size, c, 600, 'left', a);
    cx += tw(t, size, 600);
  }
}
function codePanel(x, y, w, h, rows, opts){
  const o = opts || {}, size = o.size || 26, lh = o.lh || 34, a = o.a == null ? 1 : o.a;
  rrect(x, y, w, h, 6, o.fill || 'rgba(11,17,18,.94)', o.stroke || 'rgba(80,108,108,.55)', 1.5, a);
  if (o.tabs){
    let tx = x + 18;
    o.tabs.forEach((t,i) => {
      const twd = tw(t, 20, 700) + 30, on = i === (o.tab || 0);
      rrect(tx, y+10, twd, 40, 4, on?'rgba(39,216,198,.14)':'rgba(21,29,31,.9)', on?C.cyan:'rgba(83,105,106,.5)', 1, a);
      text(t, tx+15, y+30, 20, on?C.cyan:C.muted, 700, 'left', a);
      tx += twd + 10;
    });
  }
  const top = y + (o.tabs ? 72 : 22);
  g.save(); g.beginPath(); g.rect(x, top-16, w, h-(top-y)-8); g.clip();
  rows.forEach((r,i) => {
    const yy = top + 12 + i*lh - (o.scroll || 0);
    if (yy < top-40 || yy > y+h+40) return;
    const la = o.stagger ? clamp((o.stagger - i*1.1)) : 1;
    codeLine(r, x+62, yy, size, a*la, o.hi === i);
    if (o.hi === i) rrect(x+8, yy-lh/2+2, w-16, lh-2, 2, 'rgba(39,216,198,.10)', null, 0, a*la);
  });
  g.restore();
  // 우측 페이드 — 실제 원문은 패널보다 긴 줄이 있다. 잘린 걸 잘린 티가 나게 흘린다
  // (짧게 고쳐 쓰면 그 순간 화면의 코드가 원문이 아니게 된다).
  g.save(); const fg = g.createLinearGradient(x+w-90, 0, x+w-2, 0);
  fg.addColorStop(0, 'rgba(11,17,18,0)'); fg.addColorStop(1, 'rgba(11,17,18,.98)');
  g.globalAlpha = a; g.fillStyle = fg; g.fillRect(x+w-90, top-14, 88, h-(top-y)-10); g.restore();
}

// ── 공통 크롬 ────────────────────────────────────────────────────────────────
function headBar(l, r, a=1, dy=0){
  text(l, 56, 112-dy, 30, C.cyan, 700, 'left', a, 'Pretendard,sans-serif');
  text(r, W-56, 112-dy, 22, 'rgba(238,229,213,.82)', 650, 'right', a);
  line(56, 142-dy, W-56, 142-dy, 'rgba(83,105,106,.42)', 1, [], a*.9);
}
function dots(active, a=1){
  const n = WORKS.length, gap = 40, x0 = 540 - (n-1)*gap/2;
  for (let i = 0; i < n; i++){
    const on = i === active;
    dot(x0 + i*gap, FOOTY, on ? C.cyan : 'rgba(137,149,148,.55)', on ? 9 : 5, !on, a);
  }
}
function chip(v, x, y, c=C.cyan, a=1, s=22){
  const wd = tw(v, s, 700) + 28;
  rrect(x, y-20, wd, 40, 4, 'rgba(9,12,13,.78)', c, 1.5, a);
  text(v, x+14, y, s, c, 700, 'left', a);
  return wd;
}

// ══════════════════════════════════════════════════════════════════════════
//  C0 (f0–49 · 2.000s) — 후킹. [N0 f0 「AI로 어디까지 할 수 있는지, 3초만 봐주세요」]
//  ★◆사용자 지시 = **시연 전에 TTS 대사로 후킹**. 다만 말하는 동안 화면이 비면 그게 곧
//    이탈 구간이므로, 첫 프레임부터 결과물이 풀블리드로 돌고 나머지 4종이 하단에 쌓인다
//    — 「어디까지 할 수 있는지」를 개수로 보여준 뒤 3연타로 넘긴다.
//  ★N0 발화가 **정확히 2.000s = f50** 에 끝난다(words.json 실측) → 3연타 시작과 오차 0.0f.
//  ★C0 은 durufm **의 다른 구간**(t=10.0 · assets 의 `durufm2`)을 쓴다.
//    ①C1 이 은하라 여기에 은하를 두면 컴프 경계에서 컷이 사라진다(G2)
//    ②C6 과 같은 구간을 쓰면 0초와 9초에 **같은 화면이 두 번** 나온다(컨택트 시트 육안 적발)
// ══════════════════════════════════════════════════════════════════════════
function c0(lf){
  playFull(HOOKTAG, lf);
  scrims();
  const din = eo(seg(lf, 0, 5));
  headBar('이 채널에서 코드로 만든 것들', '이 채널 · 5편', din, (1-din)*18);
  bracket(56, 176, W-112, 760, C.cyan, 30, eo(seg(lf,0,4))*.9, 3);
  // 풀블리드로 도는 건 durufm(ep13)이다 — 라벨도 그것이어야 한다.
  //  ⚠초판은 여기가 `WORKS[0]`(ep5 은하)이었다. 후킹 자산을 durufm2 로 바꾸면서 라벨과
  //    카드 인덱스가 안 따라와, **화면에 없는 편 이름이 붙고 은하가 빠져** 있었다
  //    (전체 해상도 육안 적발 · 게이트는 이런 걸 못 잡는다).
  const HOOKW = WORKS[WORKS.length - 1];          // durufm
  // 하단 카드 = 나머지 4종(은하·테트리스·수박·리듬). 중복 없이 5종이 다 나온다.
  const cw = 200, ch = 356, gap = 22, y0 = 980;
  const x0 = 540 - (4*cw + 3*gap)/2;
  for (let k = 0; k < WORKS.length - 1; k++){
    const a = eo(seg(lf, 6 + k*5, 14 + k*5));
    const y = y0 + (1-a)*54;
    rrect(x0 + k*(cw+gap) - 3, y-3, cw+6, ch+6, 5, 'rgba(9,12,13,.6)', ACC[k], 2, a);
    playTiny(WORKS[k].tag, lf, x0 + k*(cw+gap), y, cw, ch, a, k*2);
    // ★편 라벨은 카드 **안**에 넣는다. 카드 아래(y1362)에 두면 좌하단 풀블리드 라벨과
    //   x 가 겹친다(전체 해상도 육안 적발 — 축소 컨택트 시트에서는 안 보였다).
    const lx = x0 + k*(cw+gap) + 8, ly = y + ch - 24;
    rrect(lx, ly - 14, tw(WORKS[k].ep, 19, 700) + 16, 28, 3, 'rgba(9,12,13,.82)', null, 0, a);
    text(WORKS[k].ep, lx + 8, ly, 19, ACC[k], 700, 'left', a);
  }
  text(`${HOOKW.ep} · ${HOOKW.name}`, 56, 1372, 26, C.cream, 700, 'left', din, 'Pretendard,sans-serif');
  text(`${CHAN} · ${URL_PROFILE}`, 540, 1690, 18, 'rgba(137,149,148,.62)', 600, 'center', din*.9);
}

// ══════════════════════════════════════════════════════════════════════════
//  C1~C3 — 결과물 3연타(각 1.000s · 25f). 풀블리드 무크롭.
//  ★첫 프레임부터 결과물이 돌고 있다. 페이드인·인트로 카드 없음 = 0.5초 후킹.
//    HUD 는 6f(0.24s) 안에 앉고 나머지 19f 는 완성 상태로 유지된다(G6 ≥10f).
// ══════════════════════════════════════════════════════════════════════════
function shot(lf, i){
  const w = WORKS[i];
  playFull(w.tag, lf);
  scrims();
  const din = eo(seg(lf, 0, 6));
  headBar(`${w.ep} · ${w.name}`, `1080×1920 · 25fps`, din, (1-din)*18);
  bracket(56, 176, W-112, 1180, C.cyan, 30, eo(seg(lf,0,4))*.9, 3);
  chip(`${w.frames}f · ${w.secs}s`, 56, 1300, ACC[i], eo(seg(lf,2,8)));
  text(`0${i+1}`, W-56, 1300, 46, 'rgba(238,229,213,.5)', 800, 'right', eo(seg(lf,2,8)), 'PretendardBlack,sans-serif');
  dots(i, din);
  text(`${CHAN} · ${URL_PROFILE}`, 540, 1690, 18, 'rgba(137,149,148,.62)', 600, 'center', din*.9);
}
const c1 = lf => shot(lf, 0);      // galaxy
const c2 = lf => shot(lf, 1);      // tetris
const c3 = lf => shot(lf, 2);      // suika

// ══════════════════════════════════════════════════════════════════════════
//  C4 (f75–124 · 2.000s) — 코드 전면. [N1 절1 「이 화면들, 전부 코드로 그렸습니다」]
//  ★3연타 직후 결과물이 통째로 사라지고 코드만 남는다 = 컴프 경계 픽셀 변화 최대(G2).
//  ★탭·줄번호·본문 전부 실물. 첫 탭 comp.html 발췌에는 **실제 CSS 줄**이 들어 있다
//    (나레는 「코드로」라고만 말한다 — canvas 2D 로 그린 편이 섞여 있어 "CSS 로 그렸다"는
//     화면과 어긋난다. `.css`/`style` 은 실제 파일 줄이 뜨는 이 자리에서만 말한다).
// ══════════════════════════════════════════════════════════════════════════
function c4(lf){
  gridbg();
  const din = eo(seg(lf, 0, 5));
  headBar('이 채널 결과물을 만드는 파일', PKG, din);
  codePanel(56, 190, W-112, 1150, K.C4, {
    tabs:['comp.html','beats16.js','render.mjs'], tab:0, size:24, lh:44,
    stagger: seg(lf,0,14)*(K.C4.length+2), a:din, hi: lf>=16 ? K.C4_HI : -1 });
  // 우측 미니맵 — 발췌가 원문 어디인지(연속인 척하지 않는다)
  const mx = W-40, my = 210, mh = 1110;
  rrect(mx-5, my, 10, mh, 5, 'rgba(21,29,31,.9)', 'rgba(83,105,106,.45)', 1, din);
  const p0 = my + mh*K.C4_POS[0], p1 = my + mh*K.C4_POS[1];
  rrect(mx-5, p0, 10, Math.max(14, p1-p0), 5, C.cyan, null, 0, din);
  chip(`${K.C4_FILE} · ${K.C4_RANGE} / ${K.C4_TOTAL}줄`, 56, 1382, C.cyan, eo(seg(lf,6,14)));
  text(`${CHAN} · ${URL_PROFILE}`, 540, 1690, 18, 'rgba(137,149,148,.62)', 600, 'center', din*.9);
}

// ══════════════════════════════════════════════════════════════════════════
//  C5·C6 (f125–224 · 각 2.000s) — 결과물 2종 + 그 화면을 만드는 코드 병치.
//  [N1 절2 「여러분도 똑같이 만들 수 있어요」 = f125.5 온셋 · C5 시작과 0.5f]
//  ★한 화면에 결과 + 코드. 코드 패널은 하단에 얹고(면적 유지) 활성 줄 1개만 강조한다
//    — 활성 주시점 1(R8 한 쌍 규칙).
// ══════════════════════════════════════════════════════════════════════════
function pair(lf, i, rows, hi, tab, tag2){
  const w = WORKS[i];
  playFull(w.tag, lf);
  scrims();
  const din = eo(seg(lf, 0, 5));
  headBar(`${w.ep} · ${w.name}`, `${w.frames}f · ${w.secs}s`, din);
  bracket(56, 176, W-112, 780, ACC[i], 28, eo(seg(lf,0,4))*.85, 3);
  // 하단 코드 패널 — 첫 프레임부터 자리에 있고(하드컷) 줄만 스태거로 찍힌다
  codePanel(56, 990, W-112, 400, rows, {
    tabs:[tab, tag2], tab:0, size:24, lh:36, a:din,
    stagger: seg(lf,0,12)*(rows.length+2), hi: lf>=14 ? hi : -1 });
  dots(i, din);
  text(`${CHAN} · ${URL_PROFILE}`, 540, 1690, 18, 'rgba(137,149,148,.62)', 600, 'center', din*.9);
}
const c5 = lf => pair(lf, 3, K.C5, K.C5_HI, 'beats16.js', 'comp.html');   // rhythm
const c6 = lf => pair(lf, 4, K.C6, K.C6_HI, 'beats16.js', 'comp.html');   // durufm

// ══════════════════════════════════════════════════════════════════════════
//  C7 (f225–274 · 2.000s) — 고정 댓글. [N2 절1 f240 「고정 댓글에 링크를 걸어 둘게요」]
//  ★결과물 5종이 뒤로 물러나 계속 재생되고(증거층), 앞에 고정 댓글 카드가 선다.
//    카드 본문은 실제 게시 원고(고정댓글-ep16.md)와 **같은 문자열**이다.
// ══════════════════════════════════════════════════════════════════════════
function tileRow(lf, y, hgt, a){
  const n = WORKS.length, gap = 16, wdt = (W - 112 - gap*(n-1)) / n;
  WORKS.forEach((w,i) => {
    const x = 56 + i*(wdt+gap);
    rrect(x-2, y-2, wdt+4, hgt+4, 4, null, 'rgba(238,229,213,.20)', 1, a);
    playTiny(w.tag, lf, x, y, wdt, hgt, a, i*2);
  });
  return wdt;
}
function c7(lf){
  gridbg();
  const din = eo(seg(lf, 0, 5));
  headBar('코드·에셋·지시문', PKG, din);
  tileRow(lf, 200, 340, din*.55);
  const cy = 620, ch = 520;
  const rise = eo(seg(lf, 0, 10));
  rrect(72, cy + (1-rise)*40, W-144, ch, 10, 'rgba(16,23,25,.97)', 'rgba(39,216,198,.55)', 2, din);
  const oy = (1-rise)*40;
  text('📌', 112, cy+70+oy, 30, C.cyan, 700, 'left', din, 'Pretendard,sans-serif');
  text('고정된 댓글', 158, cy+70+oy, 26, C.cyan, 700, 'left', din, 'Pretendard,sans-serif');
  line(104, cy+108+oy, W-104, cy+108+oy, 'rgba(83,105,106,.45)', 1, [], din);
  text(CHAN, 104, cy+160+oy, 28, C.cream, 800, 'left', eo(seg(lf,3,11)), 'Pretendard,sans-serif');
  text(PIN1, 104, cy+228+oy, 30, 'rgba(238,229,213,.92)', 600, 'left', eo(seg(lf,6,16)), 'Pretendard,sans-serif');
  // URL 줄 — 실물
  const uw = tw(URL_PROFILE, 34, 700);
  rrect(104, cy+300+oy, uw+40, 62, 4, 'rgba(39,216,198,.10)', 'rgba(39,216,198,.5)', 1, eo(seg(lf,9,18)));
  text(URL_PROFILE, 124, cy+331+oy, 34, C.cyan, 700, 'left', eo(seg(lf,9,18)));
  line(124, cy+352+oy, 124 + tw(URL_PROFILE,34,700)*eo(seg(lf,13,22)), cy+352+oy, C.cyan, 3, [], eo(seg(lf,9,18)));
  text('↓', 540, cy+440+oy, 34, 'rgba(137,149,148,.8)', 700, 'center', eo(seg(lf,14,24)));
  text(`${CHAN} · ${URL_PROFILE}`, 540, 1690, 18, 'rgba(137,149,148,.62)', 600, 'center', din*.9);
}

// ══════════════════════════════════════════════════════════════════════════
//  C8 (f275–324 · 2.000s) — 받은 파일을 AI 에 그대로 넘긴다.
//  [N2 절2 f275.0 「받아서 그대로 AI에 전달해 보세요」 — 온셋 오차 0.0f]
//  ★채팅 UI 를 그리지 않는다(완성 시스템 인상 = 캐넌 금지). 파일 카드 → 지시 노드로
//    들어가는 **행위**만 그린다. 수신처 표기는 ep15 문법 그대로 실물이다.
// ══════════════════════════════════════════════════════════════════════════
function c8(lf){
  gridbg();
  const din = eo(seg(lf, 0, 5));
  headBar('받은 파일을 그대로', `나 → Claude Code`, din);
  const bx = 72, by = 210, bw = W-144, rh = 106;
  BUNDLE.forEach((b,i) => {
    const a = eo(seg(lf, i*2, i*2+7)), sx = (1-a)*70;
    rrect(bx+sx, by + i*(rh+14), bw, rh, 6, 'rgba(16,23,25,.96)', ACC[i], 1.5, a*din);
    text(b[0], bx+34+sx, by + i*(rh+14) + 40, 30, C.cream, 700, 'left', a*din);
    text(b[1], bx+34+sx, by + i*(rh+14) + 78, 21, C.muted, 600, 'left', a*din, 'Pretendard,sans-serif');
    text('↓', bx+bw-46+sx, by + i*(rh+14) + 58, 26, ACC[i], 700, 'center', a*din);
  });
  // 지시 노드 — 열린 채로 둔다(빈 박스 금지 규약: 안에 실제 파일명이 꽂힌다)
  const ny = 720, nh = 560;
  const na = eo(seg(lf, 6, 14));
  rrect(72, ny, W-144, nh, 8, 'rgba(11,17,18,.96)', 'rgba(39,216,198,.6)', 2, na*din);
  text('PROMPT', 106, ny+50, 22, C.cyan, 700, 'left', na);
  line(106, ny+78, W-106, ny+78, 'rgba(83,105,106,.4)', 1, [], na);
  const drop = eo(seg(lf, 11, 20));
  BUNDLE.forEach((b,i) => {
    const cw = (W-144-40-30)/4;
    rrect(106 + i*(cw+10), ny+110, cw, 76, 4, 'rgba(39,216,198,.08)', ACC[i], 1, drop);
    text(b[0], 106 + i*(cw+10) + 12, ny+148, 17, C.cream, 650, 'left', drop);
  });
  const tail = eo(seg(lf, 16, 28));
  text('이 자료 그대로 읽고 만들어 줘', 106, ny+250, 34, 'rgba(238,229,213,.94)', 700, 'left', tail, 'Pretendard,sans-serif');
  caret(106 + tw('이 자료 그대로 읽고 만들어 줘', 34, 700, 'Pretendard,sans-serif') + 12, ny+228, 44, lf, C.yellow, tail);
  line(106, ny+300, W-106, ny+300, 'rgba(83,105,106,.3)', 1, [4,8], tail);
  text('첨부 4 · 텍스트 1', 106, ny+340, 21, C.muted, 600, 'left', tail, 'Pretendard,sans-serif');
  text(`${CHAN} · ${URL_PROFILE}`, 540, 1690, 18, 'rgba(137,149,148,.62)', 600, 'center', din*.9);
}

// ══════════════════════════════════════════════════════════════════════════
//  C9 (f325–374 · 2.000s) — 자기참조. [N3 f325 「우선, 지금 보고 있는 이 영상부터 말이죠」]
//  ★「지금 보고 있는 이 영상」의 증거는 **자기 프레임 번호가 실제로 도는 것**이다.
//    NOW 마커는 gf(글로벌 프레임)의 순수 파생값이라 렌더 결과가 곧 주장의 증거가 된다.
//  ⛔나레 어절을 카드로 띄우지 않는다(재발화 금지). 화면은 눈금·마커·슬롯만 말한다.
// ══════════════════════════════════════════════════════════════════════════
function c9body(lf, a=1){
  gridbg();
  const din = eo(seg(lf, 0, 5)) * a;
  headBar('지금 재생 중인 이 영상', `ep16 · ${N}f · ${(N/FPS).toFixed(3)}s`, din);
  // 타임라인 자
  const rx = 76, rw = W-152, ry = 300, rh = 118;
  rrect(rx, ry, rw, rh, 6, 'rgba(16,23,25,.92)', 'rgba(83,105,106,.5)', 1.5, din);
  const now = FREEZE >= 0 ? FREEZE : CURF;
  COMP.forEach((c,i) => {
    const x = rx + rw*c.f0/N, wd = rw*c.len/N;
    const on = i === compAt(now);
    rrect(x+2, ry+8, wd-4, rh-16, 3, on?'rgba(39,216,198,.22)':'rgba(21,29,31,.8)', on?C.cyan:'rgba(83,105,106,.4)', on?1.5:1, din);
    text(`C${i+1}`, x+wd/2, ry+rh/2, 18, on?C.cyan:'rgba(137,149,148,.7)', 700, 'center', din);
  });
  const mx = rx + rw*now/N;
  line(mx, ry-22, mx, ry+rh+22, C.yellow, 3, [], din);
  dot(mx, ry-30, C.yellow, 7, false, din);
  text(`f${String(now).padStart(3,'0')}`, mx, ry+rh+50, 26, C.yellow, 800, 'center', din);
  text('0f', rx, ry-40, 18, C.muted, 650, 'left', din);
  text(`${N}f`, rx+rw, ry-40, 18, C.muted, 650, 'right', din);
  // 5종 + 6번째 슬롯 = 이 영상
  const ty = 560, th = 300;
  const wdt = tileRow(lf, ty, th, eo(seg(lf,4,14))*din*.9);
  text('이 채널에서 만든 것들', 56, ty-34, 22, C.muted, 650, 'left', din, 'Pretendard,sans-serif');
  // 6번째 = 지금 이 영상. 열린 프레임 안에 자기 진행 막대를 그린다(빈 박스 아님)
  const sy = ty + th + 60, sh = 420;
  const sa = eo(seg(lf, 10, 22)) * din;
  rrect(56, sy, W-112, sh, 8, 'rgba(11,17,18,.9)', C.cyan, 2, sa);
  text('06', 96, sy+56, 30, C.cyan, 800, 'left', sa, 'PretendardBlack,sans-serif');
  text('ep16', 158, sy+56, 28, C.cream, 700, 'left', sa, 'Pretendard,sans-serif');
  text(`${compAt(now)+1} / ${NB} comp`, W-96, sy+56, 24, C.muted, 650, 'right', sa);
  const px = 96, pw = W-192, py = sy+140;
  rrect(px, py, pw, 26, 4, 'rgba(21,29,31,.9)', 'rgba(83,105,106,.5)', 1, sa);
  rrect(px, py, pw*(now/N), 26, 4, 'rgba(39,216,198,.55)', null, 0, sa);
  for (let i = 0; i < NB; i++) line(px + pw*COMP[i].f0/N, py-8, px + pw*COMP[i].f0/N, py+34, 'rgba(238,229,213,.35)', 1, [], sa);
  text(`${(now/FPS).toFixed(2)}s / ${(N/FPS).toFixed(2)}s`, px, py+80, 26, C.cream, 700, 'left', sa);
  text(`1080×1920 · 25fps CFR`, px+pw, py+80, 22, C.muted, 650, 'right', sa);
  text(`${CHAN} · ${URL_PROFILE}`, 540, 1690, 18, 'rgba(137,149,148,.62)', 600, 'center', din*.9);
}
const c9 = lf => c9body(lf);

// ══════════════════════════════════════════════════════════════════════════
//  C10 (f375–424 · 2.000s) — ◆지시 직역: 「우측에서 닦아내기 형태로 영상을 구성하고 있는
//  코드가 드러난다」. 오른쪽 경계가 왼쪽으로 쓸리며 그 뒤에서 이 영상의 실제 소스가 나온다.
//  ★밑에 깔린 화면은 C9 의 **끝 상태**가 아니라 계속 살아 있는 C9 다(NOW 마커가 계속 돈다).
//    닦여 나가는 게 정지 그림이면 「이 영상」이라는 주장이 약해진다.
// ══════════════════════════════════════════════════════════════════════════
function c10(lf){
  c9body(COMP[9].len - 1);                       // 바탕 = C9 완성 상태(마커는 gf 로 계속 이동)
  // ★닦아내기 선은 **화면 밖에서 출발한다**(◆지시). 가상 시작점을 x=W+OFF 로 밀어 두면
  //   프레임 안에 들어올 때 이미 최고 속도라, 「튀어나온 게 아니라 지나가던 것이 들어온다」로 읽힌다.
  //   이징도 eio(정지→가속→정지) 대신 **eo(진입 시 최대속 → 감속)** 로 바꿨다.
  //   ⇒ 극적임(초반 속도) + 자연스러움(말미 감속)을 동시에.
  // ★바탕은 lf0 에 즉시 눌러 둔다. 이게 없으면 선이 아직 화면 밖인 lf0 에서 C09 와 픽셀이
  //   같아져 컷이 사라진다 — G2 가 실제로 잡은 결함(경계 diff 0.36)과 같은 자리다.
  g.save(); g.globalAlpha = .38; g.fillStyle = '#05080a'; g.fillRect(0,0,W,H); g.restore();
  const OFF = 300;                               // 가상 시작점이 화면 밖으로 나간 거리
  const ex = lerp(W + OFF, -60, eo(seg(lf, 0, 32)));   // W+300 → -60 · 32f 안에 통과
  const p = clamp((W - ex) / W);
  g.save(); g.beginPath(); g.rect(ex, 0, W-ex, H); g.clip();
  gridbg();
  headBar(`${K.SCROLL_FILE}`, `${K.SCROLL_RANGE} / ${K.SCROLL_TOTAL}줄`, 1);
  codePanel(56, 200, W-112, 1240, K.SCROLL.slice(0, 30), { size:25, lh:40, a:1 });
  text(`${CHAN} · ${URL_PROFILE}`, 540, 1690, 18, 'rgba(137,149,148,.62)', 600, 'center', .9);
  g.restore();
  // 닦아내기 모서리 — 얇은 시안 선 + 앞쪽 글로우
  vgrad(ex, 0, 1, H, [[0,'rgba(0,0,0,0)']]);
  g.save(); const gr = g.createLinearGradient(ex-70, 0, ex+6, 0);
  gr.addColorStop(0, 'rgba(39,216,198,0)'); gr.addColorStop(1, 'rgba(39,216,198,.30)');
  g.fillStyle = gr; g.fillRect(ex-70, 0, 76, H); g.restore();
  line(ex, 0, ex, H, C.cyan, 4, [], 1);
  // 모서리 손잡이
  rrect(ex-58, 940, 116, 40, 4, 'rgba(9,12,13,.9)', C.cyan, 1.5, 1);
  text('SRC', ex, 960, 20, C.cyan, 700, 'center', 1);
}

// ══════════════════════════════════════════════════════════════════════════
//  C11 (f475–549 · 3.000s) — 코드가 화면 위로 주르르륵 올라간다 + CTA.
//  ⛔나레 없음(◆사용자 2026-07-31: 「마지막 대사는 없이 마무리」). 마지막 3초는 코드가 흐르고
//    CTA 가 서는 화면 + BGM 만이다. 자막 밴드도 비어 있어 CTA 가 유일한 주시점이 된다.
//  ★스크롤 = lf 의 순수함수(등속 + 초반 가속). 마지막 15f 는 **정지**한다 —
//    빌드가 끝난 상태를 0.60s 유지해야 마지막 프레임이 CTA 로 읽힌다(G6).
//  ★썸네일 권고 구간이기도 하다.
// ══════════════════════════════════════════════════════════════════════════
function c11(lf){
  gridbg();
  // ★C10 → C11 은 **하드컷**이어야 한다. 둘 다 같은 발췌를 보여주므로 그대로 두면 경계
  //   픽셀 차이가 0 에 수렴해 「컷이 사라진다」(ep15 B06→B07 에서 G2 가 실제로 잡은 결함).
  //   ⇒ C11 에서 코드가 **패널을 벗고 화면 전체를 먹는다**(테두리 삭제 · 좌우 여백 0 ·
  //     글자 확대 · 시작 위치 2줄 앞당김). 첫 프레임부터 새 배치다.
  const LH = 44, HOLD = 15, RUN = COMP[11].len - HOLD;   // 60f 흐르고 15f 정지(G6 유지)
  const q = clamp(lf / RUN);
  const dist = 2*LH + (K.SCROLL.length * LH - 1080) * eio(q);
  codePanel(0, 130, W, 1300, K.SCROLL, {
    size:27, lh:LH, a:1, scroll: dist, fill:'rgba(9,12,13,.0)', stroke:null });
  // 상단 고정 헤더(스크롤 위에 덮는다)
  vgrad(0, 130, W, 110, [[0,'rgba(9,12,13,.99)'],[1,'rgba(9,12,13,0)']]);
  headBar(`${K.SCROLL_FILE}`, `${K.SCROLL_RANGE} / ${K.SCROLL_TOTAL}줄`, 1);
  // 하단 CTA — ★세이프존 x[108,886] 안에 둔다. 쇼츠 우측 x>940 은 좋아요·공유 버튼이
  //   덮는 자리라 거기에 URL 을 두면 CTA 가 통째로 가려진다(이 편의 유일한 행동 유도다).
  const ca = eo(seg(lf, 26, 44));
  vgrad(0, 1080, W, 380, [[0,'rgba(6,9,10,0)'],[1,'rgba(6,9,10,.97)']]);
  rrect(108, 1174, 778, 172, 8, 'rgba(16,23,25,.97)', C.cyan, 2, ca);
  text('📌  고정 댓글', 144, 1224, 30, C.cyan, 700, 'left', ca, 'Pretendard,sans-serif');
  text(URL_PROFILE, 144, 1300, 36, C.cream, 700, 'left', ca);
  line(144, 1326, 144 + tw(URL_PROFILE,36,700)*eo(seg(lf,34,52)), 1326, C.cyan, 3, [], ca);
  text(`${CHAN} · ${URL_PROFILE}`, 540, 1690, 20, 'rgba(137,149,148,.75)', 600, 'center', eo(seg(lf,30,46)));
}

const COMPFN = [c0,c1,c2,c3,c4,c5,c6,c7,c8,c9,c10,c11];

// ══════════════════════════════════════════════════════════════════════════
//  f0 썸네일 (◆사용자 2026-07-31 지시)
//  ★f0 **한 프레임**만 썸네일이고 f1 부터 본편이다. 40ms 라 재생에서는 안 보이고,
//    쇼츠 프레임 선택에서 첫 프레임을 고르면 그대로 썸네일이 된다.
//  ⚠ep13 사고 = 「썸네일 전용 f0 미설계」로 쇼츠 썸네일 교체가 불가능해 재렌더+재업로드를
//    강제당했다. 이 편은 f0 을 **설계해서** 굽는다.
//  ⚠판독 기준 = **200px 폭**(피드 크기). 큰 글자 6~8자 + 색 대비만 살아남는다.
//  ⛔온스크린 정직: 과장·수치 창작 없음. 「드려요」는 13단계 재현 패키지가 실제로 소스를
//    담고 있을 때만 참이다 — 저장소 없이 게시하면 이 썸네일이 거짓이 된다.
// ══════════════════════════════════════════════════════════════════════════
const BLK = 'PretendardBlack,sans-serif', PRE = 'Pretendard,sans-serif';
//  ⚠배지·타일은 **y1700 아래로 내려가면 안 된다**(G5). 썸네일이라도 피드/플레이어에서
//    하단은 제목·UI 가 덮는다. 초판은 타일 2행이 y1713 까지 내려가 G5 가 f0 을 잡았다.
function thumbBadge(y){
  const t = '📌 고정 댓글';
  const wd = tw(t, 40, 700, PRE) + 56;
  rrect(540-wd/2, y-38, wd, 76, 8, 'rgba(39,216,198,.14)', C.cyan, 3, 1);
  text(t, 540, y, 40, C.cyan, 700, 'center', 1, PRE);
}
// T-A 증거 격자 — 「여러 개를 만들었고 그 코드를 준다」를 타일 수로 말한다
function thumbA(){
  gridbg();
  text('이거 만든', 540, 270, 150, C.cream, 900, 'center', 1, BLK);
  text('코드 드려요', 540, 430, 150, C.cyan,  900, 'center', 1, BLK);
  const wdt = 264, hgt = 470, gap = 22;
  [0,1,2].forEach((i,k) => { const x = 540 - (3*wdt+2*gap)/2 + k*(wdt+gap);
    rrect(x-3, 577, wdt+6, hgt+6, 5, null, 'rgba(238,229,213,.35)', 3, 1);
    playTiny(WORKS[i].tag, 0, x, 580, wdt, hgt, 1, i*2); });
  [3,4].forEach((i,k) => { const x = 540 - (2*wdt+gap)/2 + k*(wdt+gap);
    rrect(x-3, 1087, wdt+6, hgt+6, 5, null, 'rgba(238,229,213,.35)', 3, 1);
    playTiny(WORKS[i].tag, 0, x, 1090, wdt, hgt, 1, i*2); });
  thumbBadge(1640);
}
// T-B 반반 대조 — 「이 화면이 곧 이 코드」를 한 장으로 증명한다
function thumbB(){
  gridbg();
  cover(big.galaxy[0], 0, 0, W, 880, 1);
  codePanel(0, 1040, W, 560, K.SCROLL.slice(4, 18), { size:34, lh:48, a:1,
    fill:'rgba(9,12,13,.98)', stroke:null });
  vgrad(0, 760, W, 160, [[0,'rgba(6,9,10,0)'],[1,'rgba(6,9,10,.96)']]);
  vgrad(0, 1040, W, 120, [[0,'rgba(9,12,13,.98)'],[1,'rgba(9,12,13,0)']]);
  rrect(0, 892, W, 148, 0, 'rgba(9,12,13,.94)', null, 0, 1);
  text('화면', 300, 966, 132, C.cream, 900, 'center', 1, BLK);
  text('=',    540, 966, 110, C.orange, 900, 'center', 1, BLK);
  text('코드',  790, 966, 132, C.cyan,  900, 'center', 1, BLK);
  line(0, 890, W, 890, C.cyan, 4, [], 1);
  line(0, 1042, W, 1042, C.cyan, 4, [], 1);
  thumbBadge(1660);
}
// T-C 단일 임팩트 — 가장 센 한 장 + 최대 글자. 200px 에서 글자만 남아도 읽힌다
function thumbC(){
  playFull('galaxy', 20);
  vgrad(0, 420, W, 720, [[0,'rgba(6,9,10,0)'],[.5,'rgba(6,9,10,.88)'],[1,'rgba(6,9,10,0)']]);
  text('코드 그대로', 540, 700, 158, C.cream, 900, 'center', 1, BLK);
  text('드립니다',   540, 880, 158, C.cyan,  900, 'center', 1, BLK);
  vgrad(0, 1150, W, 770, [[0,'rgba(6,9,10,0)'],[1,'rgba(6,9,10,.97)']]);
  const wdt = 196, hgt = 348, gap = 14;
  WORKS.forEach((w,i) => { const x = 540 - (5*wdt+4*gap)/2 + i*(wdt+gap);
    rrect(x-2, 1298, wdt+4, hgt+4, 4, null, 'rgba(238,229,213,.30)', 2, 1);
    playTiny(w.tag, 0, x, 1300, wdt, hgt, 1, i*2); });
  thumbBadge(1180);
}
const THUMB = { A: thumbA, B: thumbB, C: thumbC };
const THUMB_PICK = 'A';        // ◆추천안 — 판정 근거 = _명세서.md 「f0 썸네일 3안」

window.BEATS = {
  W, H, FPS, N, NB, COMP, CB, compAt, SAFE, C, WORDS_SHA, WORKS,
  setCtx, allImages, fontsReady, caption, COMPFN, THUMB, THUMB_PICK,
  setFrame: f => { CURF = f; },
  setFreeze: v => { FREEZE = v == null ? -1 : v; },
  getFreeze: () => FREEZE,
};
})();

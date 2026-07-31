// ⚙자동 생성 — build_codedata.py. 직접 고치지 말 것.
//   beats16.js / comp.html 의 **실제 줄**과 **실제 줄번호**만 들어 있다.
//   SRC_SHA = 3e3c47f6f8fc (원문 두 파일의 sha256 앞 12)
window.CODE16 = {
 "C4": [
  [
   21,
   "<style>"
  ],
  [
   22,
   "  @font-face { font-family:JetBrains;"
  ],
  [
   23,
   "               src:url(\"../_fonts/JetBrainsMono.ttf\") }"
  ],
  [
   24,
   "  @font-face { font-family:Pretendard; font-weight:800;"
  ],
  [
   25,
   "               src:url(\"../_fonts/Pretendard-ExtraBold.otf\") }"
  ],
  [
   26,
   "  @font-face { font-family:PretendardBlack; font-weight:900;"
  ],
  [
   27,
   "               src:url(\"../_fonts/Pretendard-Black.otf\") }"
  ],
  [
   28,
   "  html, body { margin:0; width:100%; height:100%;"
  ],
  [
   29,
   "               overflow:hidden; background:#090c0d }"
  ],
  [
   30,
   "  canvas     { display:block; width:1080px; height:1920px }"
  ],
  [
   31,
   "</style>"
  ],
  [
   32,
   "</head>"
  ],
  [
   33,
   "<body>"
  ],
  [
   34,
   "<canvas id=\"cv\" width=\"1080\" height=\"1920\"></canvas>"
  ],
  [
   35,
   "<script src=\"code_data.js\"></script>"
  ],
  [
   36,
   "<script src=\"beats16.js\"></script>"
  ],
  [
   37,
   "<script>"
  ],
  [
   38,
   "(() => {"
  ],
  [
   39,
   "  const B  = window.BEATS;"
  ],
  [
   40,
   "  const cv = document.getElementById('cv');"
  ],
  [
   41,
   "  const g  = cv.getContext('2d', { alpha:false });"
  ],
  [
   42,
   "  B.setCtx(g);"
  ]
 ],
 "C4_HI": 6,
 "C4_FILE": "comp.html",
 "C4_TOTAL": 74,
 "C4_RANGE": "21–42",
 "C4_POS": [
  0.2703,
  0.5676
 ],
 "C5": [
  [
   124,
   "function widx(lf, n){"
  ],
  [
   125,
   "  if (FREEZE >= 0) return 0;"
  ],
  [
   126,
   "  return Math.min(n - 1, Math.floor(lf / 2));"
  ],
  [
   127,
   "}"
  ],
  [
   128,
   "// ★스케일 펀치 — 컷 순간 1.05배에서 5f 만에 1.00 으로 앉는다. 페이드가 아니라 **타격**이라"
  ],
  [
   129,
   "//   첫 프레임이 이미 100% 보이면서도 컷이 비트로 읽힌다(0.5초 후킹 · BGM 다운비트와 물린다)."
  ],
  [
   130,
   "function playFull(tag, lf){"
  ],
  [
   131,
   "  const s = lerp(1.05, 1.0, eo(seg(lf, 0, 5)));"
  ],
  [
   132,
   "  const dw = W * s, dh = H * s;"
  ],
  [
   133,
   "  cover(big[tag][widx(lf, NBIG)], (W-dw)/2, (H-dh)/2, dw, dh, 1);"
  ],
  [
   134,
   "}"
  ]
 ],
 "C5_HI": 5,
 "C5_FILE": "beats16.js",
 "C5_TOTAL": 647,
 "C5_RANGE": "124–134",
 "C5_POS": [
  0.1901,
  0.2071
 ],
 "C6": [
  [
   43,
   "const CB  = [4, 2,2,2, 4,4,4, 4,4,4, 4, 6];   // 컴프별 박. 합 44박 = 11마디"
  ],
  [
   44,
   "const FPB = 12.5;                          // 1박 = 12.5f (BPM120 @25fps)"
  ],
  [
   45,
   "const NB  = CB.length;                     // 12 comp"
  ],
  [
   46,
   "const COMP = [];"
  ],
  [
   47,
   "{ let b = 0;"
  ],
  [
   48,
   "  for (let i = 0; i < NB; i++) {"
  ],
  [
   49,
   "    COMP.push({ b0:b, f0:Math.round(b*FPB), len:0 });"
  ],
  [
   50,
   "    b += CB[i];"
  ]
 ],
 "C6_HI": 0,
 "C6_FILE": "beats16.js",
 "C6_TOTAL": 647,
 "C6_RANGE": "43–50",
 "C6_POS": [
  0.0649,
  0.0773
 ],
 "SCROLL": [
  [
   320,
   "function shot(lf, i){"
  ],
  [
   321,
   "  const w = WORKS[i];"
  ],
  [
   322,
   "  playFull(w.tag, lf);"
  ],
  [
   323,
   "  scrims();"
  ],
  [
   324,
   "  const din = eo(seg(lf, 0, 6));"
  ],
  [
   325,
   "  headBar(`${w.ep} · ${w.name}`, `1080×1920 · 25fps`, din, (1-din)*18);"
  ],
  [
   326,
   "  bracket(56, 176, W-112, 1180, C.cyan, 30, eo(seg(lf,0,4))*.9, 3);"
  ],
  [
   327,
   "  chip(`${w.frames}f · ${w.secs}s`, 56, 1300, ACC[i], eo(seg(lf,2,8)));"
  ],
  [
   328,
   "  text(`0${i+1}`, W-56, 1300, 46, 'rgba(238,229,213,.5)', 800, 'right', eo(seg(lf,2,8)), 'PretendardBlack,sans-serif');"
  ],
  [
   329,
   "  dots(i, din);"
  ],
  [
   330,
   "  text(`${CHAN} · ${URL_PROFILE}`, 540, 1690, 18, 'rgba(137,149,148,.62)', 600, 'center', din*.9);"
  ],
  [
   331,
   "}"
  ],
  [
   332,
   "const c1 = lf => shot(lf, 0);      // galaxy"
  ],
  [
   333,
   "const c2 = lf => shot(lf, 1);      // tetris"
  ],
  [
   334,
   "const c3 = lf => shot(lf, 2);      // suika"
  ],
  [
   335,
   ""
  ],
  [
   336,
   "// ══════════════════════════════════════════════════════════════════════════"
  ],
  [
   337,
   "//  C4 (f75–124 · 2.000s) — 코드 전면. [N1 절1 「이 화면들, 전부 코드로 그렸습니다」]"
  ],
  [
   338,
   "//  ★3연타 직후 결과물이 통째로 사라지고 코드만 남는다 = 컴프 경계 픽셀 변화 최대(G2)."
  ],
  [
   339,
   "//  ★탭·줄번호·본문 전부 실물. 첫 탭 comp.html 발췌에는 **실제 CSS 줄**이 들어 있다"
  ],
  [
   340,
   "//    (나레는 「코드로」라고만 말한다 — canvas 2D 로 그린 편이 섞여 있어 \"CSS 로 그렸다\"는"
  ],
  [
   341,
   "//     화면과 어긋난다. `.css`/`style` 은 실제 파일 줄이 뜨는 이 자리에서만 말한다)."
  ],
  [
   342,
   "// ══════════════════════════════════════════════════════════════════════════"
  ],
  [
   343,
   "function c4(lf){"
  ],
  [
   344,
   "  gridbg();"
  ],
  [
   345,
   "  const din = eo(seg(lf, 0, 5));"
  ],
  [
   346,
   "  headBar('이 채널 결과물을 만드는 파일', PKG, din);"
  ],
  [
   347,
   "  codePanel(56, 190, W-112, 1150, K.C4, {"
  ],
  [
   348,
   "    tabs:['comp.html','beats16.js','render.mjs'], tab:0, size:24, lh:44,"
  ],
  [
   349,
   "    stagger: seg(lf,0,14)*(K.C4.length+2), a:din, hi: lf>=16 ? K.C4_HI : -1 });"
  ],
  [
   350,
   "  // 우측 미니맵 — 발췌가 원문 어디인지(연속인 척하지 않는다)"
  ],
  [
   351,
   "  const mx = W-40, my = 210, mh = 1110;"
  ],
  [
   352,
   "  rrect(mx-5, my, 10, mh, 5, 'rgba(21,29,31,.9)', 'rgba(83,105,106,.45)', 1, din);"
  ],
  [
   353,
   "  const p0 = my + mh*K.C4_POS[0], p1 = my + mh*K.C4_POS[1];"
  ],
  [
   354,
   "  rrect(mx-5, p0, 10, Math.max(14, p1-p0), 5, C.cyan, null, 0, din);"
  ],
  [
   355,
   "  chip(`${K.C4_FILE} · ${K.C4_RANGE} / ${K.C4_TOTAL}줄`, 56, 1382, C.cyan, eo(seg(lf,6,14)));"
  ],
  [
   356,
   "  text(`${CHAN} · ${URL_PROFILE}`, 540, 1690, 18, 'rgba(137,149,148,.62)', 600, 'center', din*.9);"
  ],
  [
   357,
   "}"
  ],
  [
   358,
   ""
  ],
  [
   359,
   "// ══════════════════════════════════════════════════════════════════════════"
  ],
  [
   360,
   "//  C5·C6 (f125–224 · 각 2.000s) — 결과물 2종 + 그 화면을 만드는 코드 병치."
  ],
  [
   361,
   "//  [N1 절2 「여러분도 똑같이 만들 수 있어요」 = f125.5 온셋 · C5 시작과 0.5f]"
  ],
  [
   362,
   "//  ★한 화면에 결과 + 코드. 코드 패널은 하단에 얹고(면적 유지) 활성 줄 1개만 강조한다"
  ],
  [
   363,
   "//    — 활성 주시점 1(R8 한 쌍 규칙)."
  ],
  [
   364,
   "// ══════════════════════════════════════════════════════════════════════════"
  ],
  [
   365,
   "function pair(lf, i, rows, hi, tab, tag2){"
  ],
  [
   366,
   "  const w = WORKS[i];"
  ],
  [
   367,
   "  playFull(w.tag, lf);"
  ],
  [
   368,
   "  scrims();"
  ],
  [
   369,
   "  const din = eo(seg(lf, 0, 5));"
  ],
  [
   370,
   "  headBar(`${w.ep} · ${w.name}`, `${w.frames}f · ${w.secs}s`, din);"
  ],
  [
   371,
   "  bracket(56, 176, W-112, 780, ACC[i], 28, eo(seg(lf,0,4))*.85, 3);"
  ],
  [
   372,
   "  // 하단 코드 패널 — 첫 프레임부터 자리에 있고(하드컷) 줄만 스태거로 찍힌다"
  ],
  [
   373,
   "  codePanel(56, 990, W-112, 400, rows, {"
  ],
  [
   374,
   "    tabs:[tab, tag2], tab:0, size:24, lh:36, a:din,"
  ],
  [
   375,
   "    stagger: seg(lf,0,12)*(rows.length+2), hi: lf>=14 ? hi : -1 });"
  ],
  [
   376,
   "  dots(i, din);"
  ],
  [
   377,
   "  text(`${CHAN} · ${URL_PROFILE}`, 540, 1690, 18, 'rgba(137,149,148,.62)', 600, 'center', din*.9);"
  ],
  [
   378,
   "}"
  ],
  [
   379,
   "const c5 = lf => pair(lf, 3, K.C5, K.C5_HI, 'beats16.js', 'comp.html');   // rhythm"
  ]
 ],
 "SCROLL_HI": -1,
 "SCROLL_FILE": "beats16.js",
 "SCROLL_TOTAL": 647,
 "SCROLL_RANGE": "320–379",
 "SCROLL_POS": [
  0.493,
  0.5858
 ],
 "SRC_SHA": "3e3c47f6f8fc"
};

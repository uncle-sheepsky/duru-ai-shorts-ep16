# 이 22초를 그린 코드

「아낌없이 주는 두루」 유입 숏폼(ep16)의 **전체 소스**입니다.
영상 안에서 우측 wipe 로 드러나 위로 올라가는 그 코드가 여기 `beats16.js` 입니다.

- 1080×1920 · 25fps CFR · **550 프레임 = 22.000초**
- BPM 120 · 1마디 50f · **11마디** · 컴프 12개
- 영상 편집 프로그램을 쓰지 않습니다. 브라우저가 캔버스에 **한 프레임씩 그립니다.**

라이선스 **CC0** — 마음대로 가져다 쓰세요. 
출처 표기도 필요 없습니다.

bgm/bgm.wav`: ★**ACE-Step 1.5 로 생성한 음원**(모델 MIT) 이 채널의 CC0 음원
  배포 대상이 **아닙니다.** 재배포하실 거면 AI 생성물임을 밝혀 주세요.

---

## 빠른 시작

```bash
cd src
npm i playwright
npx playwright install chromium
node render.mjs             # 결정론 검사(같은 프레임을 역순으로 다시 그려 픽셀 SHA 대조)
node render.mjs --all       # 550장 전부 → frames/
node render.mjs --contact   # 컴프 12개 대표 프레임을 한 장으로
```

`src/comp.html` 을 브라우저로 그냥 열어도 됩니다. 콘솔에서 `__seekTo(초)` 로 아무 시점이나 볼 수 있습니다.

음성·음악까지 합쳐 mp4 로 만들려면 (ffmpeg + Python + numpy/scipy/Pillow):

```bash
python build_audio.py       # BGM + 나레 5줄 → _mix_final.wav (-14 LUFS 착지)
python mux.py               # frames/ + wav → mp4 + 게이트 G1~G5
```

### 왜 `src/` 안에 있나

`comp.html` 이 폰트를 `../_fonts/…` 로 참조합니다. 그 줄은 **영상 화면에 그대로 뜨는 줄**이라
(저장소용으로 경로만 살짝 고치면 화면과 저장소가 갈립니다) 경로를 건드리지 않고
**디렉토리 배치로** 맞췄습니다 — `src/comp.html` 기준 `../_fonts/` 가 이 저장소의 `_fonts/` 입니다.

### 정말 같은 그림이 나오는지

작업본에서 구운 프레임과 이 패키지에서 구운 프레임을 **PNG sha256 으로 대조**했습니다:
`f0 · f24 · f110 · f180 · f300 · f430 · f549` — **7/7 동일**.

---

## 파일

> 아래는 전부 `src/` 안입니다.

| | |
|---|---|
| `beats16.js` | ★연출 정본 — 컴프 12개 · 자막 트랙 · 썸네일 3안. **화면의 거의 전부가 여기 있습니다** |
| `comp.html` | 조립 + 시간축. `__seekTo(t)` 하나가 진입점 |
| `code_data.js` | **자동 생성** — 화면에 뜨는 코드 발췌. 직접 고치지 마세요 |
| `build_codedata.py` | 위 파일을 만듭니다. `beats16.js`/`comp.html` 원문에서 **실제 줄과 실제 줄번호**를 뽑습니다 |
| `render.mjs` · `browser.mjs` | 결정론 렌더 + 게이트 |
| `build_audio.py` | 나레 배치(어절 온셋을 컴프 경계에 물림) + 10:90 믹스 + −14 LUFS 착지 |
| `mux.py` | mp4 + 형식 게이트 G1~G5 |
| `hold_gate.html` · `hold_gate.mjs` · `hold_report.py` | G6 — 컴프가 완성 상태로 몇 프레임 유지되는지 |
| `thumb.html` · `render_thumb.mjs` | f0 썸네일 3안 + **200px 판독 대조 시트** |
| `assets/big` · `assets/tiny` | 영상에 지나가는 결과물 프레임(이 채널이 만든 영상들의 게시본에서 추출) |
| `lufs_spread.py` | BS.1770-4 라우드니스 계측기. `loudnorm` 의 `input_i` 는 3초 넘는 라인에서 실제값과 어긋납니다 |
| `../_fonts/` | JetBrains Mono · Pretendard (둘 다 **OFL** · 라이선스 파일 동봉) |
| `narration/nar/*.wav` | 나레이션 5줄 + 어절 타임스탬프 |
| `bgm/splice_A.wav` | 배경음악 22.000초 발췌본 · `gen_candidates.py` 에 생성 프롬프트와 시드 |
| `편-계약.json` | 이 편의 모든 확정값(격자·온셋·라우드니스·자산). 화면 수치는 전부 여기서 파생 |

---

## 이 저장소가 하는 특이한 것 두 가지

**① 화면에 뜨는 코드는 지어낼 수가 없습니다.**
`build_codedata.py` 가 빌드할 때 `beats16.js` / `comp.html` **원문에서 앵커 문자열을 찾아**
그 위치의 줄과 줄번호를 뽑습니다. 앵커를 못 찾거나 두 번 나오면 빌드가 실패합니다.
그리고 `render.mjs` 가 원문 두 파일의 sha256 을 `code_data.js` 에 각인된 값과 대조해,
소스를 고친 뒤 다시 굽지 않았으면 렌더 자체를 거부합니다.

**② 화면 전체가 `(컴프, 프레임)` 의 순수함수입니다.**
`Math.random` · `Date.now` · CSS transition · `filter:blur` 를 쓰지 않습니다.
그래서 몇 번을 돌리든, 어느 순서로 시크하든 같은 프레임이 나옵니다.
`node render.mjs` 가 그걸 **역순으로 다시 그려 픽셀 해시로** 확인합니다.

---

## 만들어 보고 싶다면

[`PROMPTS.md`](PROMPTS.md) 에 STEP 0~10 으로 지시문을 정리해 뒀습니다.
AI 에게 그대로 넘기시면 됩니다. 자기 소재로 바꿔서 STEP 1 부터 다시 하면 됩니다.

---

## 밝혀 둘 것

- **나레이션**은 제 목소리 녹음본입니다.

- **배경음악**은 ACE-Step 1.5 로 생성한 뒤 11마디 격자에 맞춰 자르고 마스터했습니다. 프롬프트와 시드는 `bgm/gen_candidates.py` 에 있습니다.

- **`assets/` 는 약 70MB** 입니다. 이 채널이 게시한 영상들에서 뽑은 프레임이고, 뽑는 스크립트는 `assets/extract_works.py` 입니다(원본 mp4 는 들어 있지 않습니다).

- 화면에 지나가는 **두루(캐릭터)** 클립은 그 편들에서 생성형 AI 로 만든 것입니다.

- 배경음악 원본 45초 3후보는 용량 때문에 넣지 않았습니다. 같은 프롬프트·시드로 다시 생성할 수 있습니다.

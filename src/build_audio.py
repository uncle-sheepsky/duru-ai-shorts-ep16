#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""build_audio.py — ep16 유입 숏폼 오디오. 22.000s(550f@25fps) = BGM 11마디 + 나레 4라인.

캐넌 준수: ⛔덕킹 0 · 10:90 에너지 지분 · **정적 게인 + 피크 삭감**(loudnorm 착지 금지) ·
alimiter `level=disabled`(ep15 12단계 실측 함정 — level 기본 켜짐이 정적 게인을 덮어쓴다).

★배치는 수기 타이밍이 아니라 **어절 온셋이 컴프 경계를 정한 결과**다.
  타이밍 원천 = narration/nar/words.json (words_sha 916a161b25e1 · R7).
  아래 ONSET 표를 assert 로 막는다 — 길이나 나레를 바꾸면 여기가 제일 먼저 터진다(R16/R3).

  ★◆사용자 실녹음(균일 배속 1.040× · 라인레벨 −19.50 LUFS · 크레스트 13.0~13.2).
  N0 f000 : 후킹. **발화 종료** 1.980s → f049.5 vs C1 시작 f050 (오차 −0.5f)
  N1 f125 : 「여러분도」 2.000s → f175.0  vs C5 시작 f175  (오차  0.0f)
  N2 f285 : 「받아서」   1.600s → f325.0  vs C8 시작 f325  (오차  0.0f)
  N3 f387 : ⛔컴프 경계에 안 붙인다 — **N2 와의 간격**이 더 중요하다(◆0.38s 반려).
            f387 = 간격 0.72s · 발화 종료 f440(C10 wipe 55% 지점에서 문장이 끝난다)
  ⛔N4 없음 — ◆사용자 2026-07-31 「마지막 대사는 없이 마무리」. C11(475~549 · 3.0초)은
     코드 스크롤 + CTA + BGM 만이다.

★BGM 소스가 바뀌면 지분·착지를 **재역산**한다(R5 — 관습값 이월 금지).
"""
import math, os, sys, subprocess
import numpy as np
from scipy.io import wavfile

try: sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception: pass

HERE = os.path.dirname(os.path.abspath(__file__))
def _root(p):
    """작업 트리면 센티넬 경로, 공개 저장소로 클론했으면 None."""
    while p and not os.path.exists(os.path.join(p, ".akashic-root")):
        q = os.path.dirname(p)
        if q == p: return None
        p = q
    return p
# ★작업 트리 안이면 공용 계측기를, 공개 저장소로 클론한 경우엔 **옆에 담아 둔 사본**을 쓴다.
#   BS.1770-4 정본 계측기다 — loudnorm 의 input_i 는 3초 초과 라인에서 실제값과 어긋난다(실측).
ROOT = _root(HERE)
if ROOT:
    sys.path.insert(0, os.path.join(ROOT, "projects", "hyak", "tools"))
sys.path.insert(0, HERE)
from lufs_spread import integrated_lufs      # noqa: E402
import json
WORDS = json.load(open(os.path.join(HERE, "narration", "nar", "words.json"), encoding="utf-8"))

SR, FPS, N = 44100, 25, 550
SHARE = 0.10
TARGET, TP_LIMIT = -14.0, -1.0
# ★믹스 wav 를 ±0.3 로만 맞추면 **AAC mux 후**가 −14.3 이 되어 G4 경계에 걸린다(실측).
#   인코딩이 0.1 정도 더 내리므로 여기서 0.15 로 조여 둔다 — 게이트를 느슨하게 하는 대신
#   납품물이 목표 한가운데 앉게 만든다.
LAND_TOL = 0.15
# ★AAC 여유 — wav 를 TP −1.00 으로 맞춰도 **mux 후 mp4 는 −0.9** 가 된다(실측). 인터샘플
#   피크가 인코딩에서 드러나기 때문이다. G4 는 mp4 를 재는 게이트라 wav 쪽에서 미리 빼 둔다.
#   ⚠게이트를 느슨하게 하는 대신 **산출물을 목표 안으로** 넣는 방향(ep15 12단계와 같은 판단).
AAC_MARGIN = 0.15
PICK = os.environ.get("EP16_BGM", "I")        # ◆청취 채택본. A~F 는 반려·기각(_명세서 §BGM)

# 컴프 시작 프레임 (beats16.js CB=[4,2,2,2,4,4,4,4,4,4,4,6] · 1박 12.5f · 컴프 이름은 C0~C11)
COMP_F0 = [0, 50, 75, 100, 125, 175, 225, 275, 325, 375, 425, 475]
# 라인 → (시작 프레임, 검사 방식, 검사할 어절, 상대초, 걸려야 할 컴프 인덱스 0-base)
#   "on"  = 그 어절의 **온셋**이 컴프 경계에 앉아야 한다
#   "end" = 라인의 **발화 종료**가 컴프 경계에 앉아야 한다(후킹 라인 → 시연 시작)
PLACE = [("N0",   0, "end", "봐주세요", 2.000,  1),
         ("N1", 134, "on",  "여러분도", 1.660,  5),
         ("N2", 284, "on",  "받아서",   1.640,  8),
         ("N3", 396, None,  None,       None,  None)]

# ★라인 간 간격 게이트 — ◆사용자가 N2→N3 를 「너무 급함」으로 반려했다.
#   ⚠★그때 내가 보고한 0.38s 는 **ASR 어절 끝** 기준이었고, 실제 **들리는 간격은 0.07s** 였다
#     (ASR 어절 끝이 소리 끝보다 0.3~0.4s 이르다 — 실측). 지표가 5배 틀린 상태로 판단했다.
#   ⇒ 간격은 반드시 **들리는 경계**(파일 길이 − 말단 페이드·패딩)로 잰다.
#   하한 0.30s = 반려된 0.07s 위에서 주웠다. 현행 배치의 N2→N3 는 0.60s.
GAP_MIN = 0.30
TAIL_PAD = 0.160        # process_recorded 의 말단 페이드(40ms)+패딩(120ms) = 소리가 아니다

bgm_path = os.path.join(HERE, "bgm", f"splice_{PICK}.wav")
sr_b, bgm = wavfile.read(bgm_path)
assert sr_b == SR, f"BGM sr {sr_b}"
bgm = bgm.astype(np.float64) / (32768 if bgm.dtype == np.int16 else 1)
if bgm.ndim > 1: bgm = bgm.mean(1)
assert abs(len(bgm) / SR - N / FPS) < 1e-6, f"BGM 길이 {len(bgm)/SR}s ≠ {N/FPS:.3f}s"

nar = np.zeros(int(N / FPS * SR))
print(f"BGM = bgm/splice_{PICK}.wav  ({len(bgm)/SR:.3f}s)\n")
for lab, f0, mode, word, ws, comp in PLACE:
    p = os.path.join(HERE, "narration", "nar", f"{lab}.wav")
    nsr, clip = wavfile.read(p)
    assert nsr == SR, f"{lab} sr {nsr}"
    clip = clip.astype(np.float64) / 32768
    s0 = int(round(f0 / FPS * SR))
    nar[s0:s0+len(clip)] += clip[:len(nar)-s0]
    dur_f = round(len(clip) / SR * FPS)
    if mode is None:
        print(f"{lab} f{f0}~f{f0+dur_f}  ({len(clip)/SR:.3f}s)")
        continue
    mark_f = f0 + ws * FPS
    want = COMP_F0[comp]
    err = mark_f - want
    kind = "온셋" if mode == "on" else "발화종료"
    print(f"{lab} f{f0}~f{f0+dur_f}  ({len(clip)/SR:.3f}s) · 「{word}」 {kind} f{mark_f:.1f} "
          f"vs C{comp:02d} 시작 f{want} (오차 {err:+.1f}f)  {'OK' if abs(err) <= 1 else '★어긋남'}")
    # ★어긋났을 때 **어디로 옮기면 맞는지**를 같이 낸다. 녹음본이 바뀌면 여기가 제일 먼저 터지는데,
    #   "1f 초과" 만 알려주면 사람이 다시 손으로 역산해야 한다(그러다 틀린다).
    assert abs(err) <= 1.0, (
        f"{lab}「{word}」 {kind}가 C{comp:02d} 경계 f{want} 에서 {err:+.1f}f 이탈. "
        f"⇒ 이 녹음으로 맞추려면 PLACE 의 {lab} 시작을 f{f0} → **f{round(f0 - err)}** 로 옮겨라"
        f"(그만큼 라인이 앞/뒤로 움직인다). 배치를 유지하려면 그 줄을 다시 읽어야 한다. "
        f"⚠beats16.js 의 LINES[].start 도 **같은 값**으로 고치고 재렌더할 것 — 자막이 따로 논다.")

# 라인 간 간격 — **들리는 경계**로 잰다(ASR 어절 끝이 아니다. 위 GAP_MIN 주석 참조)
_prev = None
for lab, f0, *_ in PLACE:
    dur = len(wavfile.read(os.path.join(HERE, "narration", "nar", lab + ".wav"))[1]) / SR
    a, b = f0, f0 + (dur - TAIL_PAD) * FPS
    if _prev is not None:
        gap = (a - _prev[1]) / FPS
        ok = gap >= GAP_MIN
        print("   %s → %s 들리는 간격 %.2fs  %s" % (_prev[0], lab, gap, "OK" if ok else "★급함"))
        assert ok, "%s → %s 들리는 간격 %.2fs 가 하한 %.2fs 미만" % (_prev[0], lab, gap, GAP_MIN)
    _prev = (lab, b)

n = min(len(bgm), len(nar))
bgm, nar = bgm[:n], nar[:n]

# ── 10:90 에너지 지분 (⛔덕킹 0 — 발화 구간에서만 지분을 잰다) ────────────
speech = np.abs(nar) > 10 ** (-45/20)
speech = np.convolve(speech.astype(float), np.ones(int(0.1*SR)), "same") > 0
E_n = float((nar[speech] ** 2).mean())
E_b = float((bgm[speech] ** 2).mean())
gain = math.sqrt(E_n * SHARE / (1-SHARE) / max(E_b, 1e-18))
mix = nar + bgm * gain
print(f"\n발화 커버 {100*speech.mean():.1f}% · BGM 고정 게인 {20*math.log10(gain):+.2f}dB "
      f"(지분 {SHARE:.0%} · 덕킹 0)")

I0 = integrated_lufs(mix, SR)
print(f"원시 믹스  I {I0:.2f} LUFS · TP {20*math.log10(np.abs(mix).max()+1e-12):.2f} dBFS")


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")


def ebur128(path):
    r = run(["ffmpeg", "-nostdin", "-hide_banner", "-i", path,
             "-filter_complex", "ebur128=peak=true", "-f", "null", "-"])
    lines = (r.stderr or "").splitlines()
    I = tp = None
    for i, ln in enumerate(lines):
        s = ln.strip()
        if s.startswith("I:") and "LUFS" in s and "Integrated" in lines[max(i-1, 0)]:
            I = float(s.split()[1])
        if s.startswith("Peak:") and "dBFS" in s:
            tp = float(s.split()[1])
    return I, tp


# ★게인 / limit **두 변수를 분리 수렴**시킨다(ep15 v1 교훈 — 얽으면 발산한다).
#   attack=1ms(5ms 는 이 정도 리미팅 폭에서 트랜지언트를 놓쳐 최대 1dB 새 나간다) ·
#   limit 은 AAC 인터샘플 여유 0.2dB 를 먼저 깔고 시작한다.
gB = TARGET - I0
lim_db = TP_LIMIT - 0.2
pre = os.path.join(HERE, "_mix_pre.wav")
final_wav = os.path.join(HERE, "_mix_final.wav")
I = tp = None
for attempt in range(14):
    wavfile.write(pre, SR, (mix * 10 ** (gB/20)).astype(np.float32))
    lim = 10 ** (lim_db/20)
    r = run(["ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-i", pre, "-af",
             f"alimiter=level_in=1:level_out=1:limit={lim:.6f}:attack=1:release=50:asc=1:level=disabled",
             "-c:a", "pcm_f32le", final_wav])
    if r.returncode:
        sys.exit(f"[ERROR] alimiter 실패\n{(r.stderr or '')[-600:]}")
    I, tp = ebur128(final_wav)
    print(f"[착지 {attempt+1}] 게인 {gB:+.2f}dB · limit {lim_db:+.2f}dB → I {I:.2f} / TP {tp:.2f}")
    if tp <= TP_LIMIT - AAC_MARGIN and abs(I - TARGET) <= LAND_TOL:
        break
    if tp > TP_LIMIT - AAC_MARGIN:
        lim_db -= (tp - TP_LIMIT + AAC_MARGIN) + 0.1
    else:
        gB += TARGET - I

ok = abs(I - TARGET) <= LAND_TOL and tp <= TP_LIMIT - AAC_MARGIN
print(f"\n최종  I {I:.2f} LUFS · TP {tp:.2f} dBFS (목표 {TARGET}/{TP_LIMIT}) → {'PASS' if ok else '★FAIL'}")
print(f"→ _mix_final.wav")

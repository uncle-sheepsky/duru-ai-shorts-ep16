#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""mux.py — ep16 유입 숏폼. frames/ + _mix_final.wav → ep16_giveaway_v1.mp4 + 형식 게이트.

게이트는 전부 **실행·측정**이다(같은 모델 자평 아님 — 검증 캐넌 ①등급).
  G1 블랙 프레임 0 · 의미 공백 프레임 0(평균 휘도 하한)
  G2 ★컴프 전환 밀도 — 11개 컴프 경계가 전부 컴프 **내부** 모션의 상위 전환점인지.
     「2초에 한 번 화면이 바뀐다」를 선언이 아니라 픽셀에서 재는 게이트.
     기준 = 경계 diff > 컴프내 p90 **그리고** ≥ median×5 (ep15 에서 실제 결함 1건을 잡은 기준.
     p99 기준은 기각 — 그건 "컴프 안에 큰 사건이 있으면 안 된다"를 요구해 설계와 충돌한다).
  G3 mux 후 ffprobe ↔ 렌더 프레임 수 ↔ 화면 상수 3자 대조
  G4 라우드니스 **재계측**(★문서가 아니라 mux 산출물 파일을 잰다 — ep15 12단계 사고)
  G5 하단 플랫폼 UI 대역(y>1700)에 밝은 정보층이 없는지
  ⚠G6(컴프 유지 시간)은 상시 모션을 고정해야 참값이 나오므로 별도다 → hold_gate.mjs
"""
import os, sys, subprocess, json
import numpy as np
from PIL import Image

try: sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception: pass

HERE = os.path.dirname(os.path.abspath(__file__))
FR   = os.path.join(HERE, "frames")
WAV  = os.path.join(HERE, "_mix_final.wav")
OUT  = os.path.join(HERE, os.environ.get("EP16_OUT", "ep16_giveaway_v1.mp4"))
FPS, N, NB = 25, 550, 12
COMP_F0 = [0, 50, 75, 100, 125, 175, 225, 275, 325, 375, 425, 475]   # beats16.js CB 파생
# ★C10→C11 은 컷이 아니다 — ◆사용자 스토리보드가 「우측 wipe 로 코드가 드러나면서 그대로
#   위로 올라간다」는 **한 동작**으로 지정했다. 컷 밀도를 채우려고 여기에 인위적 단절을
#   넣는 건 지시 위반이다. ⇒ 게이트에서 제외하되 **숫자와 함께 명시**한다(조용한 면제 금지).
G2_CONTINUOUS = {10}


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")


print("프레임 적재…")
small = np.zeros((N, 480, 270), dtype=np.float32)
for f in range(N):
    im = Image.open(os.path.join(FR, f"f{f:04d}.png")).convert("L").resize((270, 480), Image.BILINEAR)
    small[f] = np.asarray(im, dtype=np.float32)

# ── G1 ────────────────────────────────────────────────────────────────────
means = small.reshape(N, -1).mean(axis=1)
black = [f for f in range(N) if means[f] < 2.0]
faint = [f for f in range(N) if means[f] < 6.0]
print(f"G1 블랙 프레임 {len(black)} · 저휘도(<6) {len(faint)} · 평균휘도 "
      f"{means.min():.2f}~{means.max():.2f} → {'PASS' if not black and not faint else '★FAIL'}")

# ── G2 컴프 전환 밀도 ─────────────────────────────────────────────────────
# ★ep15 는 전역 p90 을 썼다. 이 편에서 **그 임계가 틀린 게 드러났다**:
#   C1~C6 은 결과물이 풀블리드로 재생돼 컴프 **내부** 프레임차가 원래 크고, C7~C11 은 정적
#   합성이라 원래 작다. 전역 p90 은 앞쪽 영상 모션에 끌려 올라가서 뒤쪽 정적 컴프에
#   「그 구간에서는 일어날 수 없는 크기」를 요구한다(C07→C08 6.50 vs 전역 p90 8.32 로 오탐).
#   ⇒ 재려는 건 "여기서 평소보다 크게 바뀌었나"이므로 **인접 두 컴프 내부의 분포**와 비교한다.
#   ⚠임계를 데이터에 맞춰 느슨하게 한 게 아니다: 진짜 결함(C09→C10 = 0.36 = 컷 소멸)이
#     이 국소 기준에서도 잡히는지 확인하고 고정했다.
diff = np.abs(np.diff(small.reshape(N, -1), axis=0)).mean(axis=1)   # diff[i] = f(i+1)-f(i)
bounds = [f - 1 for f in COMP_F0[1:]]                                # 10개
SPAN = COMP_F0 + [N]
weak, detail = [], []
for k, b in enumerate(bounds):
    loc = np.concatenate([diff[SPAN[k]:SPAN[k+1]-1], diff[SPAN[k+1]:SPAN[k+2]-1]])
    p90, med = float(np.percentile(loc, 90)), float(np.median(loc))
    ok = diff[b] > p90 and diff[b] >= 5 * med
    exempt = k in G2_CONTINUOUS
    detail.append((k, float(diff[b]), p90, med, ok, exempt))
    if not ok and not exempt:
        weak.append((k, float(diff[b]), p90, med))
ntest = len(bounds) - len(G2_CONTINUOUS)
print(f"G2 컴프 전환 밀도 — 검사 대상 {ntest}개 중 {ntest-len(weak)} 이 **인접 컴프 내부** "
      f"p90 초과 & median×5 이상? "
      f"{'PASS' if not weak else '★FAIL ' + ', '.join(f'C{k:02d}→C{k+1:02d} {v:.2f}(p90 {p:.2f})' for k, v, p, m in weak)}"
      + (f"  · 연속 선언 제외 {sorted(G2_CONTINUOUS)}" if G2_CONTINUOUS else ""))
for k, dv, p90, med, ok, ex in detail:
    tag = '연속(제외)' if ex else ('OK' if ok else '★약함')
    print(f"   C{k:02d}→C{k+1:02d} diff {dv:8.2f}  국소 p90 {p90:7.2f}  median {med:6.2f}  "
          f"median 대비 {dv/max(med,1e-9):7.1f}배  {tag}")

# ── G5 하단 플랫폼 UI 대역 ────────────────────────────────────────────────
bot = small[:, 425:, :]                       # y>1700 (1920×425/480)
bot_max = bot.reshape(N, -1).max(axis=1)
hot = [f for f in range(N) if bot_max[f] > 150]
print(f"G5 하단 UI 대역(y>1700) 최대휘도 {bot_max.max():.0f} · 밝은 프레임 {len(hot)} "
      f"→ {'PASS' if not hot else '★확인필요 f' + ','.join(map(str, hot[:8]))}")

# ── mux ───────────────────────────────────────────────────────────────────
print("\nmux…")
r = run(["ffmpeg", "-hide_banner", "-y", "-framerate", str(FPS),
         "-i", os.path.join(FR, "f%04d.png"), "-i", WAV,
         "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p",
         "-c:a", "aac", "-b:a", "256k", "-shortest", "-movflags", "+faststart", OUT])
if r.returncode:
    sys.exit(f"[ERROR] mux 실패\n{(r.stderr or '')[-800:]}")

# ── G3 3자 대조 ───────────────────────────────────────────────────────────
pr = run(["ffprobe", "-v", "error", "-select_streams", "v:0",
          "-show_entries", "stream=nb_frames,width,height,r_frame_rate",
          "-show_entries", "format=duration", "-of", "json", OUT])
meta = json.loads(pr.stdout)
st, fm = meta["streams"][0], meta["format"]
nbf, dur = int(st["nb_frames"]), float(fm["duration"])
ok3 = (nbf == N and abs(dur - N/FPS) < 0.001 and st["width"] == 1080
       and st["height"] == 1920 and st["r_frame_rate"] == "25/1")
print(f"G3 ffprobe {st['width']}×{st['height']} {st['r_frame_rate']} · {nbf}f · {dur:.3f}s "
      f"↔ 렌더 {N}f ↔ 화면상수 {N}f/{N/FPS:.3f}s → {'PASS' if ok3 else '★FAIL'}")

# ── G4 라우드니스 재계측(mux 산출물) ──────────────────────────────────────
r = run(["ffmpeg", "-nostdin", "-hide_banner", "-i", OUT,
         "-filter_complex", "ebur128=peak=true", "-f", "null", "-"])
lines = (r.stderr or "").splitlines()
I = TP = LRA = None
for i, ln in enumerate(lines):
    s = ln.strip()
    if s.startswith("I:") and "LUFS" in s and "Integrated" in lines[max(i-1, 0)]:
        I = float(s.split()[1])
    if s.startswith("LRA:") and "LU" in s:
        LRA = float(s.split()[1])
    if s.startswith("Peak:") and "dBFS" in s:
        TP = float(s.split()[1])
# ⚠1e-9 은 임계 완화가 아니라 **부동소수 경계** 처리다 — ffmpeg 가 소수 1자리로 보고하는
#   −14.3 은 abs(-14.3+14.0) 이 0.3000000000000007 이라 그냥 비교하면 FAIL 이 뜬다.
okL = I is not None and abs(I + 14.0) <= 0.3 + 1e-9 and TP is not None and TP <= -0.95
print(f"G4 mux 산출물 I {I} LUFS · TP {TP} dBFS · LRA {LRA} LU (목표 −14.0 / ≤−1.0) "
      f"→ {'PASS' if okL else '★FAIL'}")

r = run(["ffmpeg", "-nostdin", "-hide_banner", "-i", OUT,
         "-af", "silencedetect=n=-50dB:d=0.04", "-f", "null", "-"])
sil = [l.strip() for l in (r.stderr or "").splitlines() if "silence_start" in l or "silence_end" in l]
print(f"   무음(-50dB/0.04s) 이벤트 {len(sil)}" + ("  " + " | ".join(sil[:4]) if sil else ""))

print(f"\n→ {os.path.basename(OUT)}  ({os.path.getsize(OUT)/1e6:.2f} MB)")

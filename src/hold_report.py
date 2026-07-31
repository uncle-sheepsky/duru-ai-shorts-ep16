#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""hold_report.py — G6 컴프 유지 시간 판정. _hold/ → 컴프별 빌드 종료 프레임 + 유지 시간 표.

★재는 것 = 「컴프가 완성 상태로 몇 프레임 머무는가」.
  ⛔상시 모션(결과물 재생·커서·NOW 마커·자막)은 hold_gate.html 이 이미 고정했다.
    그걸 안 끄면 3박 컴프도 「유지 0f」로 찍힌다(ep15 v4 실측 — 지표가 두 번 오염됐다).

★하한 0.40s(10f)는 **창작 임계가 아니다**. ep15 v4 에서 ◆사용자가 좋다고 판정한 구간의
  실측 유지 하한대(최소 0.40s · 평균 0.68s)를 그대로 승계한 값이다.
  ⚠이 편은 컴프가 1.0s / 2.0s / 3.0s 라 ep15(1.0/1.5s)보다 여유가 크다 — 그래서 하한을
    올리지 않는다. 승인된 구간에서 주운 값을 임의로 조이면 그건 다시 지어낸 임계다.
"""
import os, sys
import numpy as np
from PIL import Image

try: sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception: pass

HERE = os.path.dirname(os.path.abspath(__file__))
HOLD = os.path.join(HERE, "_hold")
FPS = 25
MIN_HOLD_F = 10          # 0.40s — ep15 승인 구간 실측 하한
EPS = 0.35               # 다운샘플 그레이 평균 절대차 — 이보다 작으면 "안 변했다"

rows, fails = [], []
for d in sorted(os.listdir(HOLD)):
    p = os.path.join(HOLD, d)
    if not os.path.isdir(p):
        continue
    files = sorted(f for f in os.listdir(p) if f.endswith(".png"))
    ims = np.stack([np.asarray(Image.open(os.path.join(p, f)).convert("L")
                               .resize((270, 480), Image.BILINEAR), dtype=np.float32)
                    for f in files])
    n = len(ims)
    diff = np.abs(ims[1:] - ims[:-1]).reshape(n-1, -1).mean(axis=1)
    moving = np.where(diff > EPS)[0]
    end = int(moving.max()) + 1 if len(moving) else 0     # 마지막으로 변한 프레임
    hold = n - 1 - end
    ok = hold >= MIN_HOLD_F
    rows.append((d, n, end, hold, hold / FPS, ok, float(diff.max())))
    if not ok:
        fails.append(d)

print(f"{'컴프':<6}{'길이f':>6}{'빌드종료lf':>11}{'유지f':>7}{'유지s':>8}   판정")
for d, n, end, hold, hs, ok, dm in rows:
    print(f"{d:<6}{n:>6}{end:>11}{hold:>7}{hs:>8.2f}   {'OK' if ok else '★짧다'}")
hs = [r[4] for r in rows]
print(f"\nG6 컴프 유지 시간 — {len(rows)-len(fails)}/{len(rows)} 이 ≥{MIN_HOLD_F}f({MIN_HOLD_F/FPS:.2f}s) "
      f"→ {'PASS' if not fails else '★FAIL ' + ', '.join(fails)}")
print(f"   최소 {min(hs):.2f}s · 평균 {sum(hs)/len(hs):.2f}s")

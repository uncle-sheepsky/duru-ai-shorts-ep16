#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""build_codedata.py — 화면에 뜨는 코드를 **원문에서만** 뽑는다 → code_data.js

★왜 스크립트인가 (ep15 에서 적발된 사고 클래스를 구조적으로 없앤다)
  ep15 숏폼은 코드 패널 5줄의 줄번호를 `032~036` 으로 적었는데 실제로는 32·122·157·181·192 였다
  (연속도 아니었다). 사람이 옮겨 적는 한 이 사고는 반복된다.
  ⇒ 여기서는 **앵커 문자열로 원문을 찾아 줄번호를 계산**한다. 못 찾으면 빌드가 실패한다.
    화면에 나오는 모든 코드 줄·줄번호·총 줄수·발췌 위치는 전부 실행 시점의 원문 파생값이다.

★SRC_SHA — beats16.js/comp.html 을 고치면 줄번호가 밀린다. 렌더 게이트가 이 해시로
  「code_data.js 가 현재 원문에서 나온 것인가」를 대조한다(스테일 금지 · R7 계열).

발췌 정책:
  · 전부 **연속 구간**이다. 비연속 발췌를 붙여 연속인 척하지 않는다.
  · 각 발췌는 (파일, 시작 앵커, 줄 수)로만 지정한다.
"""
import os, re, sys, json, hashlib
try: sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception: pass

HERE = os.path.dirname(os.path.abspath(__file__))
BEATS = os.path.join(HERE, "beats16.js")
COMPH = os.path.join(HERE, "comp.html")

# (키, 파일, 시작 앵커(원문에 정확히 1회 등장해야 한다), 줄 수, 강조할 상대 줄)
CUTS = [
    ("C4",     COMPH, "<style>",                              22, 6),
    ("C5",     BEATS, "function widx(lf, n){",                11, 5),
    ("C6",     BEATS, "const CB  = [4, 2,2,2, 4,4,4, 4,4,4, 4, 6];", 8, 0),
    ("SCROLL", BEATS, "function shot(lf, i){",                60, -1),
]


def load(p):
    with open(p, encoding="utf-8") as f:
        return f.read().split("\n")


def cut(lines, anchor, n, path):
    hits = [i for i, l in enumerate(lines) if anchor in l]
    if len(hits) != 1:
        sys.exit(f"★앵커가 {len(hits)}회 등장 (1회여야 한다): {anchor!r} in {os.path.basename(path)}")
    i0 = hits[0]
    return [[i0 + 1 + k, lines[i0 + k].rstrip()] for k in range(n)], i0


if __name__ == "__main__":
    src = {}
    out = {}
    for key, path, anchor, n, hi in CUTS:
        lines = src.setdefault(path, load(path))
        rows, i0 = cut(lines, anchor, n, path)
        out[key] = rows
        out[key + "_HI"] = hi
        base = os.path.basename(path)
        out[key + "_FILE"] = base
        out[key + "_TOTAL"] = len(lines)
        out[key + "_RANGE"] = f"{rows[0][0]}–{rows[-1][0]}"
        out[key + "_POS"] = [round(i0 / len(lines), 4), round((i0 + n) / len(lines), 4)]
        longest = max(len(r[1]) for r in rows)
        print(f"  {key:<7}{base:<14}{out[key+'_RANGE']:>10} / {len(lines):>4}줄   "
              f"최장 {longest}자")

    h = hashlib.sha256()
    for p in (BEATS, COMPH):
        h.update(open(p, "rb").read())
    out["SRC_SHA"] = h.hexdigest()[:12]

    body = "window.CODE16 = " + json.dumps(out, ensure_ascii=False, indent=1) + ";\n"
    hdr = ("// ⚙자동 생성 — build_codedata.py. 직접 고치지 말 것.\n"
           "//   beats16.js / comp.html 의 **실제 줄**과 **실제 줄번호**만 들어 있다.\n"
           f"//   SRC_SHA = {out['SRC_SHA']} (원문 두 파일의 sha256 앞 12)\n")
    with open(os.path.join(HERE, "code_data.js"), "w", encoding="utf-8") as f:
        f.write(hdr + body)
    print(f"\n★SRC_SHA = {out['SRC_SHA']}\n→ code_data.js")

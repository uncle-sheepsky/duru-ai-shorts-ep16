#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""extract_works.py — ep16 유입 숏폼 결과물 자산. **결과물 mp4(실제 게시본)** 에서 프레임을 뽑는다.

★ep15 와 다른 점: 이 채널 결과물 7편이 **전부 세로 1080×1920** 이다(ffprobe 실측 2026-07-31).
  창에 넣거나 크롭할 필요가 없다 → **풀블리드 무크롭**. 0.5초 후킹 = 면적 × 모션이고,
  레터박스 창은 면적을 버린다(ep15 는 랜드스케이프 소스라 창이 강제였다).

★규격이 두 번 바뀐 이유 = **디코딩 메모리**(파일 크기가 아니라 RGBA 비트맵).
  1080×1920 = 8.3MB/장. 풀블리드 5종을 각 25장 물면 1.0GB 를 넘는다.
  ep15 가 실제로 통과한 규모는 289장 × 1.74MB ≈ 503MB 였다. 그 아래로 맞춘다.
    big  810×1440 (4.67MB) × 25장 × 5종 ≈ 583MB   ← 풀블리드용. 0.75배 축소 후 1.33배 확대
    tiny 270× 480 (0.52MB) × 12장 × 5종 ≈  31MB   ← 증거층 썸네일

★샘플링 = **12.5fps**(소스 30fps → 12.5fps 리샘플). 컴프 프레임 lf 에 대해 idx=floor(lf/2)
  로 읽으면 25fps 실시간 재생이 된다(작화 "on twos"). 25장 = 소스 2.000초 =
  2초 컴프(50f)를 정확히 덮고, 1초 컴프(25f)는 앞 13장만 쓴다.
"""
import os, sys, json, subprocess
try: sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception: pass

HERE = os.path.dirname(os.path.abspath(__file__))
def _root(p):
    while p and not os.path.exists(os.path.join(p, ".akashic-root")):
        q = os.path.dirname(p)
        if q == p: raise RuntimeError("root")
        p = q
    return p
ROOT = _root(HERE)
RES = os.path.join(ROOT, "projects", "hyak", "결과물")
SFPS = 12.5                       # 샘플링 레이트 — idx = floor(lf/2) 로 25fps 실시간

# tag, 결과물 상대경로, video_id(채널 실측 2026-07-31), t0(초), 라벨
# ★t0 는 probe_sheet.png / probe_sheet2.png 대조로 고른 값이다(창작 아님 · 각 25장 실물 비교).
#   기각: ep11 컨텍스트(채팅 UI = 캐넌 회피) · ep1-motion 전반부(요소 희박) · ep9 전반부(빈 네이비)
WORKS = [
    ("galaxy",  "ep5-galaxy-renewal/hyak-ep5-galaxy.mp4",  "9yYM9r2m7v4", 15.0, "은하 충돌"),
    ("suika",   "ep10-structure/hyak-ep10.mp4",            "pb0A82OLX70", 16.0, "과일 물리"),
    ("durufm",  "ep13-repro/hyak_ep13_repro_durufm.mp4",   "DjTz9COkTlc",  2.0, "라디오 HUD"),
    # ★C0(후킹) 전용 — C6 과 **같은 구간을 쓰면 0초와 9초에 같은 화면이 두 번 나온다**
    #   (컨택트 시트 육안 적발). 같은 편의 다른 시각을 뽑아 반복을 없앤다.
    #   ⚠t=15/17 은 ep13 의 고정 댓글 안내(STEP 0~7)가 화면에 떠 있어 이 편의 안내(STEP 0~10)와
    #     어긋나 보인다 → 기각. t=10 은 주제 정합이고 이 편에 대해 아무것도 주장하지 않는다.
    ("durufm2", "ep13-repro/hyak_ep13_repro_durufm.mp4",   "DjTz9COkTlc", 10.0, "라디오 HUD(후킹)"),
    ("rhythm",  "ep1-motion/hyak-ep1-motion.mp4",          "w0syDA5-qqs", 42.0, "리듬 게임"),
    ("tetris",  "ep9-tetris/hyak-ep9.mp4",                 "W0jmcwhIbos", 24.0, "T-스핀 판정"),
]
N_BIG, N_TINY = 25, 12


def run(c):
    return subprocess.run(c, capture_output=True, text=True, encoding="utf-8", errors="replace")


def grab(tag, rel, t0, n, w, h, outdir):
    src = os.path.join(RES, rel.replace("/", os.sep))
    if not os.path.exists(src):
        return f"★없음 {rel}"
    os.makedirs(outdir, exist_ok=True)
    vf = (f"fps={SFPS},scale={w}:{h}:force_original_aspect_ratio=decrease,"
          f"pad={w}:{h}:(ow-iw)/2:(oh-ih)/2:color=0x000000")
    run(["ffmpeg", "-hide_banner", "-y", "-ss", f"{t0:.2f}", "-i", src,
         "-frames:v", str(n), "-vf", vf, os.path.join(outdir, f"{tag}_%03d.png")])
    got = len([x for x in os.listdir(outdir) if x.startswith(tag + "_")])
    return f"{got}/{n}" + ("" if got == n else "  ★부족")


if __name__ == "__main__":
    man = {"_규격": {"big": f"810x1440 @{SFPS}fps 무크롭 · {N_BIG}장 = 소스 2.000s",
                    "tiny": f"270x480 @{SFPS}fps 무크롭 · {N_TINY}장"},
           "_읽는법": "idx = floor(lf/2) → 25fps 실시간(on twos)",
           "_소스": "결과물 mp4 = 실제 게시본",
           "_실측": "2026-07-31 ffprobe — 채널 결과물 7편 전부 세로 1080×1920",
           "works": []}
    for tag, rel, vid, t0, label in WORKS:
        a = grab(tag, rel, t0, N_BIG, 810, 1440, os.path.join(HERE, "big"))
        b = grab(tag, rel, t0, N_TINY, 270, 480, os.path.join(HERE, "tiny"))
        print(f"  {tag:<8}{rel:<44}t{t0:>5.1f}  big {a}  tiny {b}")
        man["works"].append({"tag": tag, "src": rel, "video_id": vid, "t0": t0, "label": label,
                             "n_big": N_BIG, "n_tiny": N_TINY})
    json.dump(man, open(os.path.join(HERE, "works_manifest.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)
    print("\n→ big/ · tiny/ · works_manifest.json")

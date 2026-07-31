#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""gen_candidates.py — ep16 유입 숏폼 BGM 후보 생성 (10단계).

도구 = ACE-Step 1.5 · 서버 127.0.0.1:8001 · batch_size 1.
  기동: D:\\ai-tools\\repos\\ACE-Step-1.5\\.venv\\Scripts\\python.exe -u -m acestep.api_server

★격자 (R16 동결):
  22.000s = 550f @25fps · BPM 120 · 1마디 50f(2.0s) · **11마디** · 44박
  ⚠생성은 45s 로 넉넉히 받고 **마디 단위 스플라이스**로 20.000s 에 정착시킨다.
    ep14 실측 = ACE 생성물은 **샘플0에 마디 첫박이 없다**(10~25f) → 원본 그대로 쓰면 R4 위반.

★BPM 120 재사용 선언 — 은폐하지 않는다.
  이 편은 사용자 스펙(결과물 3초 3종 / 4초 2종 / 컴프 2초)이 전부 **1.000초 격자**다.
  25fps 에서 1.000초가 정수 박이 되는 템포는 120(=2박) 계열뿐이고, 20.000s 가 정수 마디로
  떨어져야 BGM 이음매가 0 이 된다. ⇒ 120 은 **선택이 아니라 격자의 유일해**다(ep15 와 동일 사유).
  재탕 회피는 템포가 아니라 **음색·화성·리듬격자**에서 낸다:

| 축 | ep15(회피 대상) | ep16 |
|---|---|---|
| 음색 | warm/soft/cozy · 일렉피아노·나일론기타·마림바 | **hard neon arcade** · 게이티드 스탭·디스토션 베이스 |
| 화성 | G Major · 밝은 진행 | **A minor 모달 드론**(정적 드론 + 2코드 뱀프) = 대장 미사용 archetype |
| 격자 | soft four-on-floor | **오프비트/브로큰 킥**(4F 과점 탈피 — 대장 축3 4F 5/9) |
| 아크 | calm → brighter(80s 롱폼) | **0.0s 부터 최대**(첫 타격) → 유지 → 후반 리프트 |

⚠steps/10: ACE 생성물은 3축 지문 산출이 어려워 **대장 등재 불가**(편11·ep14·ep15 선례).
  재탕 판정은 **청취 + 이 프롬프트 기록**으로 대체하고 그 사실을 계약에 남긴다
  (`fingerprint_id = null` 은 누락이 아니라 선언).

★이 편의 BGM 조건:
  · 나레 커버율 = 발화 10.6s / 20.0s = **53%** — ep15(76%)보다 낮다. 무나레 구간이 길다:
    f0–72(2.88s 오프닝 3연타) · f161–240(3.16s) · f377–430(2.12s) · f474–500(1.04s)
    ⇒ **오프닝 2.88초를 BGM 혼자 끈다.** 여기가 0.5초 후킹의 청각 절반이다.
  · 비중 10:90 · 덕킹 0(ep13 ablation) · 보이스대 300–3500Hz 를 비울 것
"""
import os, subprocess, sys, json
try: sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception: pass

HERE = os.path.dirname(os.path.abspath(__file__))
CLIENT = r"D:\ai-tools\work\audio-analysis\ace_generate.py"
PY = sys.executable

BPM, DUR, KEY, TS = 120, 45, "A Minor", "4/4"

# ── 1차 후보 A·B·C (2026-07-31 오전) ─────────────────────────────────────────
# ◆청취 결과 = **전부 반려**. 사유(사용자): 「좀 더 튜토리얼 같은 느낌 / 메인 리드 소리가
# 작은, 박자 악기 위주」. A(hard neon arcade)·B(dark industrial)·C(chiptune breakbeat)는
# 셋 다 **리드가 앞에 나오는 곡**이었다 — 수치(보이스대·경계 타격)로는 A가 최선이었지만
# 그건 후보 압축용이고 결정은 귀다(대장 §2 · 편1 v3.4 선례). 기록만 남기고 교체한다.
BED_V1 = ("instrumental only, no vocals, no lead melody line, "
          "midrange kept clear for a spoken voiceover, "
          "static single-chord modal drone bass, no chord progression, "
          "strong impact right at the very first beat, energy stays high, "
          "syncopated off-beat kick, not four-on-the-floor, clean punchy mix")
CAND_V1 = {
    "A": ("hard neon arcade electro, gated saw stabs, distorted sub bass, "
          "tight noise snare, metallic hi-hats, aggressive, " + BED_V1, 20260801),
    "B": ("dark industrial techno hook bed, heavy processed percussion, "
          "granular metallic textures, dry room, relentless, " + BED_V1, 20260802),
    "C": ("chiptune-hybrid breakbeat, crunchy 8-bit square stabs, "
          "hard breakbeat drums, filtered noise sweeps, playful but hard, " + BED_V1, 20260803),
}

# ── 2차 후보 D·E·F (◆재요청) ────────────────────────────────────────────────
# 바뀐 조건 3개를 프롬프트에 직접 박는다:
#   ①「튜토리얼 같은 느낌」 → 밝고 차분, 공격성 제거
#   ②「메인 리드 소리가 작은」 → 리드를 빼는 게 아니라 **뒤로 물린다**(mixed low / background)
#   ③「박자 악기 위주」    → 선율 악기가 아니라 **타악·리듬 요소가 곡을 끈다**
# ⛔유지: BPM120(격자 유일해) · 진행 없는 정적 모달 드론(대장 미사용 archetype) ·
#        보이스대(300–3500Hz) 비우기 · f0 타격.
# ⚠ep15 의 warm cute lo-fi(일렉피아노·나일론기타·마림바)와 겹치지 않게 **타악 팔레트를 분리**한다
#   — ep15 는 선율 악기가 곡을 끌었고, 여기선 타악이 끈다.
BED = ("instrumental only, no vocals, "
       "any melodic lead is mixed low and stays in the background, "
       "percussion carries the track, groove-first arrangement, "
       "midrange kept clear for a spoken voiceover, "
       "static single-chord modal drone bass, no chord progression, "
       "clear accent on the very first beat, steady energy, no build-ups, no breakdown, "
       "syncopated off-beat kick, not four-on-the-floor, clean uncluttered mix")

# ── 3차 후보 G·H·I (구멍 때문에 재생성) ────────────────────────────────────
# ★2차 D·E·F 는 브리프(타악 튜토리얼)는 맞았는데 **수십 ms 짜리 구멍**이 났다.
#   실측: D 채택본이 최종 믹스에서 −26.4 → **−59.3 dBFS 를 45ms 만에** 떨어졌다(33dB).
#   나레가 없는 구간이라 그 순간 전체가 비어 그루브가 끊긴다.
#   2차 프롬프트에도 "static single-chord modal drone bass" 는 넣었지만 ACE 가 안 지켰다.
#   ⇒ **지속을 명령형으로 여러 번, 그리고 "빈틈을 채우는 레이어"를 지정**한다.
#   구멍 가드는 prep_bgm.best_window 에 하드 게이트로 박아 두었다(HOLE_DB 30 / HOLE_MS 25).
SUSTAIN = ("a continuous sustained low drone runs under everything from the first second "
           "to the last and never stops, "
           "a constant shaker or closed-hat layer fills every gap between hits, "
           "no silence anywhere, no empty bars, no drop-outs, no stops, "
           "wall-to-wall continuous texture")

CAND = {
    "G": ("bright friendly tutorial groove led by hand percussion, "
          "congas and shakers and claves, soft rim clicks, warm woodblock, "
          "no melodic hook, " + SUSTAIN + ", " + BED, 20260821),
    "H": ("warm tutorial bed, steady tambourine and shaker groove, soft kick and rim, "
          "muted short plucks used as rhythm not melody, "
          "gentle and encouraging, " + SUSTAIN + ", " + BED, 20260822),
    "I": ("calm percussive tutorial bed, brushed snare ostinato, light bongos, "
          "soft mallet clicks, humming sustained bass note underneath, "
          "no lead instrument, " + SUSTAIN + ", " + BED, 20260823),
}

if __name__ == "__main__":
    print(f"BPM {BPM} · {KEY} · {TS} · {DUR}s · batch 1\n")
    meta = {}
    for tag, (prompt, seed) in CAND.items():
        out = os.path.join(HERE, f"cand_{tag}.wav")
        print(f"── {tag}  seed {seed}")
        print(f"   {prompt[:96]}…")
        r = subprocess.run([PY, CLIENT, "--prompt", prompt, "--bpm", str(BPM),
                            "--key", KEY, "--timesig", TS, "--duration", str(DUR),
                            "--seed", str(seed), "--out", out],
                           capture_output=True, text=True, encoding="utf-8", errors="replace")
        ok = os.path.exists(out)
        for l in [l for l in (r.stdout or "").splitlines() if l.strip()][-3:]:
            print("   " + l)
        if not ok:
            print("   ★실패"); print("   " + (r.stderr or "")[-400:])
        meta[tag] = dict(prompt=prompt, seed=seed, bpm=BPM, key=KEY, timesig=TS,
                         duration=DUR, out=os.path.basename(out), ok=ok)
        print()

    json.dump({"_격자": {"total_s": 22.0, "total_f": 550, "fps": 25, "bpm": BPM,
                        "bar_f": 50, "bars": 11, "beats": 44},
               "_주의": "생성 45s → 마디 스플라이스로 22.000s 정착. ACE 는 샘플0이 마디 첫박이 아니다",
               "_지문": "ACE 생성물은 3축 지문 산출 불가 → 대장 미등재. 재탕 판정 = 청취 + 프롬프트 기록",
               "_2차구멍": {"후보": ["D","E","F"], "사유": "수십 ms 구멍(D 실측 −26.4 → −59.3 dBFS / 45ms). 지속 명령 강화해 재생성",
                           "가드": "prep_bgm.best_window 에 HOLE_DB 30 / HOLE_MS 25 하드 게이트 신설"},
               "_1차반려": {"후보": list(CAND_V1), "사유": "◆청취 — 리드가 앞에 나온다. 튜토리얼 느낌 + 리드 작게 + 박자 악기 위주로 재요청",
                           "프롬프트": {k: v[0] for k, v in CAND_V1.items()}},
               "_BPM재사용": "격자 유일해(1.000s = 2박 · 22.000s = 정수 11마디). 회피는 음색·화성·리듬격자에서",
               "candidates": meta},
              open(os.path.join(HERE, "gen_meta.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)
    print("→ gen_meta.json")

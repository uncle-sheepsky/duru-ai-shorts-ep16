#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""make_wordstamps.py — ep16 09단계. nar/*.wav → nar/words.json + words_sha.

★R3: 워드스탬프는 **시간축 최종 확정본**에서만 만든다.
   이 편의 나레는 TTS 라 08(속도) 단계가 `tts_narrate.py --rate 8.1` 안에서 이미 닫혔다
   (라인별 atempo 로 8.04~8.21음절/s 정착 · 스프레드 0.10 LU). 나레를 재생성하면 이 파일은
   **스테일**이다 — 반드시 재실행.

★R7: 11단계 comp 에 여기서 낸 `words_sha` 를 각인하고, 12단계에서 3자 대조한다.

⚠오전사 규약: ASR 결과의 **자막 텍스트만** 대본으로 교정하고 **타이밍은 보존**한다.
⚠용도 = 워드싱크 자막 트랙 + 컴프 경계 온셋 검증.
  ⛔나레 문장을 화면 타이포로 재발화하는 데 쓰지 말 것(ep14 교정①).
"""
import os, sys, json, hashlib
try: sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception: pass
from faster_whisper import WhisperModel

HERE = os.path.dirname(os.path.abspath(__file__))
NAR = os.path.join(HERE, "nar")
LINES = json.load(open(os.path.join(HERE, "lines.json"), encoding="utf-8"))

MODEL = "large-v3"      # ep13·ep14·ep15 선례. small 은 한국어 어절 경계가 흔들린다
model = WhisperModel(MODEL, device="cpu", compute_type="int8")

out, tot_w = {}, 0
print(f"모델 {MODEL} · 라인 {len(LINES)}\n")
for lab, txt in LINES.items():
    wav = os.path.join(NAR, f"{lab}.wav")
    if not os.path.exists(wav):
        print(f"{lab}: [없음]"); continue
    segs, _ = model.transcribe(wav, language="ko", word_timestamps=True, beam_size=5)
    words = []
    for s in segs:
        for w in (s.words or []):
            words.append([w.word.strip(), round(w.start, 3), round(w.end, 3)])
    out[lab] = words; tot_w += len(words)
    bad = [i for i in range(1, len(words)) if words[i][1] < words[i-1][2] - 1e-6]
    flag = f"  ★겹침 {len(bad)}" if bad else ""
    print(f"{lab:<7}{len(words):>3}w  {words[-1][2] if words else 0:>6.3f}s{flag}")
    print(f"        ASR: {' '.join(x[0] for x in words)}")
    print(f"        대본: {txt}")

payload = json.dumps(out, ensure_ascii=False, indent=1, sort_keys=True)
sha = hashlib.sha256(payload.encode("utf-8")).hexdigest()[:12]
with open(os.path.join(NAR, "words.json"), "w", encoding="utf-8") as f:
    f.write(payload)
with open(os.path.join(NAR, "words_sha.txt"), "w", encoding="utf-8") as f:
    f.write(sha + "\n")
print(f"\n총 {tot_w} 어절 · ★words_sha = {sha}")
print("→ nar/words.json · nar/words_sha.txt")

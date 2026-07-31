#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""prep_bgm.py — ep16 BGM 후보 실측 → 20.000s 스플라이스 → ◆청취용 오디션 믹스.

세 단계를 한 파일에 둔다(ep15 는 analyze/make_auditions 분리였는데, 이 편은 20초 한 구간이라
분리 이득이 없다). 절차 정본 = 음원-지문-대장 §2.

① 실측(후보 압축용 · **결정은 ◆귀**)
   · 보이스대 300–3500Hz 점유율 = 나레이션 방해도 직접 지표
     ⚠수치 1위가 채택이 아니다 — 편1 v3.4 에서 6.2% 를 제치고 48.5% 가 귀 판정으로 채택됐다
   · 마디 첫박 오프셋 — ★ACE 생성물은 샘플0이 다운비트가 아니다(ep14 실측 10~25f)
   · 마디별 RMS · 통합 LUFS · 피크

② 스플라이스 = **10마디(20.000s) 정확**. 다운비트 격자의 모든 창 중
   ⓐ에너지 딥 하드 가드(어떤 마디도 창 중앙값보다 4dB 넘게 낮으면 제외)를 통과한 것 가운데
   ⓑ**11개 컴프 경계 타격의 최솟값**이 최대인 창(동점이면 첫 마디가 센 창)을 고른다.
   근거: 이 편은 1~2초마다 하드컷이고 컷이 음악 사건 위에 앉아야 한다. ⓐ는 지표가 트랙
   페이드아웃 꼬리를 집는 걸 막는다(실측 사고 — best_window 주석).

③ 오디션 = 나레 베드에 10:90 으로 얹은 믹스(체인 = 최종 믹스 동일 · 차이가 곡뿐이 되게 통제).
   ⛔덕킹 0(ep13 ablation — 덕킹·광대역 압축이 먹먹함의 원인).
"""
import os, sys, json, math, subprocess
try: sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception: pass
import numpy as np
from scipy.io import wavfile
from scipy.signal import stft

HERE = os.path.dirname(os.path.abspath(__file__))
EP = os.path.dirname(HERE)
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
sys.path.insert(0, os.path.dirname(HERE))
from lufs_spread import integrated_lufs      # noqa: E402

BPM, FPS, N = 120, 25, 550
BAR_S = 4 * 60 / BPM            # 2.0s
BARS, TOTAL_S = 11, 22.0
SR_OUT = 44100                  # 나레(TTS 파이프) 규격 — ACE 산출 48kHz 를 여기로 맞춘다
DIP_MAX = 4.0                   # 마디 RMS 가 창 중앙값보다 이만큼 넘게 낮으면 창 자체를 버린다
# ★구멍 가드 — 마디 평균은 멀쩡한데 **수십 ms 짜리 구멍**이 나는 트랙이 있다.
#   실측(후보 D): 최종 믹스에서 −26.4 → **−59.3 dBFS 가 45ms 만에** 빠졌다(33dB). 나레가 없는
#   구간이라 그 순간 전체가 비어 그루브가 끊긴다. 마디 RMS 딥 가드로는 절대 안 잡힌다
#   (구멍이 짧아서 마디 평균을 거의 안 흔든다). ⇒ 별도 가드가 필요하다.
#   판정 = 20ms RMS 가 창 중앙값보다 HOLE_DB 넘게 낮은 상태로 HOLE_MS 이상 지속.
HOLE_DB, HOLE_MS = 30.0, 25.0
SHARE = 0.10
NAR = [("N0", 0), ("N1", 130), ("N2", 289), ("N3", 375)]   # ★beats16.js LINES[].start 와 동일


def load(p):
    sr, x = wavfile.read(p)
    if x.dtype == np.int16: x = x.astype(np.float64) / 32768
    elif x.dtype == np.int32: x = x.astype(np.float64) / 2147483648
    else: x = x.astype(np.float64)
    return sr, x


def mono(x): return x.mean(1) if x.ndim > 1 else x


def voiceband(x, sr):
    f, _, Z = stft(mono(x), sr, nperseg=4096, noverlap=2048)
    P = (np.abs(Z) ** 2).mean(1)
    b = (f >= 300) & (f <= 3500)
    return float(P[b].sum() / max(P.sum(), 1e-12))


def downbeat_offset(x, sr):
    """마디 첫박이 샘플0에서 얼마나 밀렸는가 — 저역 온셋 상승에지 최대점(앞 2마디 안)."""
    seg = mono(x)[:int(BAR_S * 2 * sr)]
    f, t, Z = stft(seg, sr, nperseg=1024, noverlap=768)
    low = (np.abs(Z[(f >= 30) & (f <= 140)]) ** 2).sum(0)
    d = np.diff(low, prepend=low[0]); d[d < 0] = 0
    k = int(np.argmax(d))
    return float(t[k])


def holes(x, sr, s0=None, n=None):
    """창 안의 「구멍」 목록 (시작초, 길이ms). 절대 레벨이 아니라 **창 중앙값 대비**로 본다."""
    m = mono(x)
    if s0 is not None:
        m = m[s0:s0 + n]
    w = int(0.02 * sr)
    rms = np.sqrt(np.convolve(m ** 2, np.ones(w) / w, "same"))
    pos = rms[rms > 0]
    if len(pos) == 0:
        return []
    thr = np.median(pos) * 10 ** (-HOLE_DB / 20)
    low = rms < thr
    out, c, st = [], 0, 0
    for i, v in enumerate(low):
        if v:
            if c == 0: st = i
            c += 1
        elif c:
            if c / sr * 1000 >= HOLE_MS: out.append((round(st / sr, 3), round(c / sr * 1000)))
            c = 0
    if c and c / sr * 1000 >= HOLE_MS: out.append((round(st / sr, 3), round(c / sr * 1000)))
    return out


def bar_rms(x, sr, s0, nbars):
    m = mono(x); L = int(BAR_S * sr)
    return [round(20 * math.log10(math.sqrt((m[s0+i*L:s0+(i+1)*L] ** 2).mean()) + 1e-12), 2)
            for i in range(nbars)]


def onset_curve(x, sr):
    """저역(30–140Hz) 온셋 상승 곡선 + 그 트랙의 정규화 기준(양의 중앙값).

    ★정규화를 **트랙당 한 번** 구한다. 창마다 다시 구하면 창끼리 비교가 안 된다
      (밀도가 다른 구간은 중앙값이 달라져 같은 타격이 다른 숫자가 된다).
    ⚠같은 이유로 이 값은 **후보 A/B/C 사이 비교에는 못 쓴다** — 트랙마다 기준이 다르다.
      쓰는 자리는 오직 「같은 트랙 안에서 어느 창이 나은가」다."""
    f, t, Z = stft(mono(x), sr, nperseg=1024, noverlap=768)
    low = (np.abs(Z[(f >= 30) & (f <= 140)]) ** 2).sum(0)
    d = np.diff(low, prepend=low[0]); d[d < 0] = 0
    return t, d, max(float(np.median(d[d > 0])), 1e-12)


def hits_at(t, d, med, t0):
    """창 시작이 t0 일 때 11개 컴프 경계에서의 타격(중앙값 배수)."""
    out = []
    for f0 in COMP_F0:
        c = t0 + f0 / FPS
        w = (t >= c - 0.06) & (t <= c + 0.10)      # 경계 ±약 1~2프레임
        out.append(float(d[w].max() / med) if w.any() else 0.0)
    return out


def best_window(x, sr, off_s):
    """다운비트 격자 위의 10마디 창 중 **모든 컴프 경계에 타격이 있는** 창.

    ★기준을 바꾼 이유: 이 편은 1~2초마다 하드컷이 들어간다. 컷 하나가 음악상 허공에 뜨면
      「초당 한 번 전환」이 소리로 안 읽힌다. ⇒ 1순위 = **경계 타격의 최솟값**(가장 약한 컷),
      동점이면 첫 마디 RMS(오프닝 2.88초를 BGM 혼자 끄므로 f0 타격이 그다음으로 중요).
    ⚠ep15 의 「마디 RMS 편차가 작은 창」을 그대로 이월하진 않았다 — 그건 80초 롱폼에서
      에너지 딥을 피하려던 기준이고 여기서 1순위는 컷 정합이다. **다만 딥 가드는 남긴다**:
      최소타격만으로 고르게 했더니 후보 B 가 **마지막 마디 −25.3dB(트랙 페이드아웃 꼬리)** 인
      창을 집었다(실측). 그 창을 쓰면 CTA 2초가 무음이 된다.
      ⇒ 하드 가드 = 어떤 마디도 창 중앙값보다 DIP_MAX dB 넘게 낮으면 **후보에서 제외**.
        지표가 내용을 정하게 두지 않는다 — 지표는 남은 후보들 사이에서만 고른다."""
    m = mono(x); L = int(BAR_S * sr)
    t, d, med = onset_curve(x, sr)
    s_off = int(round(off_s * sr))
    nmax = (len(m) - s_off) // L
    best, bestscore, dropped, dropped_h = None, None, 0, 0
    for k in range(0, nmax - BARS + 1):
        s0 = s_off + k * L
        r = bar_rms(x, sr, s0, BARS)
        if float(np.median(r)) - min(r) > DIP_MAX:      # 에너지 딥 하드 가드
            dropped += 1; continue
        hl = holes(x, sr, s0, int(TOTAL_S * sr))        # 구멍 하드 가드
        if hl:
            dropped_h += 1; continue
        h = hits_at(t, d, med, s0 / sr)
        score = (round(min(h), 2), round(r[0], 1))      # 1순위 최소타격 · 2순위 첫 마디 세기
        if bestscore is None or score > bestscore:
            bestscore, best = score, (k, s0, r, h)
    print(f"      딥 가드 제외 {dropped} · 구멍 가드 제외 {dropped_h} / 전체 {nmax-BARS+1} 창")
    if best is None:
        print("      ★통과 창 없음 — 이 후보는 못 쓴다")
        return None
    return best


COMP_F0 = [0, 50, 75, 100, 125, 175, 225, 275, 325, 375, 425, 475]   # beats16.js 와 동일



def run(c): return subprocess.run(c, capture_output=True, text=True, encoding="utf-8", errors="replace")


def build_bed(sr):
    bed = np.zeros(int(TOTAL_S * sr))
    for lab, f0 in NAR:
        p = os.path.join(EP, "narration", "nar", f"{lab}.wav")
        nsr, clip = wavfile.read(p)
        assert nsr == sr, f"{lab} sr {nsr} != {sr}"
        clip = clip.astype(np.float64) / 32768
        s0 = int(round(f0 / FPS * sr))
        bed[s0:s0+len(clip)] += clip[:len(bed)-s0]
    return bed


if __name__ == "__main__":
    res = {}
    print(f"{'후보':<5}{'초':>7}{'보이스대':>9}{'LUFS':>8}{'피크':>7}{'다운비트f':>10}")
    import glob as _g
    tags = sorted(os.path.basename(x)[5:-4] for x in _g.glob(os.path.join(HERE, "cand_*.wav")))
    for tag in tags:
        p = os.path.join(HERE, f"cand_{tag}.wav")
        if not os.path.exists(p):
            print(f"{tag:<5}[없음]"); continue
        sr, x = load(p)
        vb, I = voiceband(x, sr), integrated_lufs(x, sr)
        pk = 20 * math.log10(np.abs(x).max() + 1e-12)
        off = downbeat_offset(x, sr)
        print(f"{tag:<5}{len(x)/sr:>7.2f}{vb*100:>8.1f}%{I:>8.2f}{pk:>7.2f}{off*FPS:>10.2f}")
        allh = holes(x, sr)
        print("      전체 구멍(중앙값 -%gdB 이상 %gms 초과) %d개  %s"
              % (HOLE_DB, HOLE_MS, len(allh), allh[:6]))
        bw = best_window(x, sr, off)
        if bw is None:
            res[tag] = dict(rejected="통과 창 없음(딥/구멍 가드)", holes_all=len(allh)); continue
        k, s0, bars, hit = bw
        t0_src = s0 / sr                     # ★원본 기준 시각 — 아래에서 sr 이 44100 으로 바뀐다
        cut = x[s0:s0 + int(round(TOTAL_S * sr))]
        assert abs(len(cut)/sr - TOTAL_S) < 1e-9, f"스플라이스 길이 {len(cut)/sr}"
        # ★ACE 산출은 48kHz, 나레(TTS 파이프)는 44.1kHz 다. 믹스 전에 나레 쪽으로 맞춘다.
        #   20.000s 는 48000·44100 양쪽에서 정수 샘플(960000 / 882000)이라 길이 손실이 없다.
        tmp = os.path.join(HERE, f"_cut_{tag}.wav")
        wavfile.write(tmp, sr, cut.astype(np.float32))
        sp = os.path.join(HERE, f"splice_{tag}.wav")
        run(["ffmpeg","-hide_banner","-v","error","-y","-i",tmp,
             "-ar", str(SR_OUT), "-ac","1","-c:a","pcm_s16le", sp])
        os.remove(tmp)
        srx, cx = load(sp)
        assert srx == SR_OUT and len(cx) == int(TOTAL_S*SR_OUT), \
            f"스플라이스 규격 {srx}Hz {len(cx)}샘플 (기대 {SR_OUT}Hz {int(TOTAL_S*SR_OUT)})"
        cut, sr = cx, srx
        res[tag] = dict(voiceband_pct=round(vb*100,1), lufs=round(I,2), peak_db=round(float(pk),2),
                        downbeat_s=round(off,4), downbeat_f=round(off*FPS,2),
                        window_bar=k, window_t0=round(t0_src,4), bar_rms=bars,
                        bar_spread=round(max(bars)-min(bars),2),
                        comp_hit=[round(v,2) for v in hit],
                        comp_hit_min=round(min(hit),2), comp_hit_mean=round(float(np.mean(hit)),2))
        print(f"      창 bar{k} (t={t0_src:.3f}s) 마디RMS " + " ".join(f"{v:.1f}" for v in bars)
              + f"   편차 {max(bars)-min(bars):.1f}dB")
        print(f"      컴프 경계 타격 " + " ".join(f"{v:.2f}" for v in hit)
              + f"   최소 {min(hit):.2f} / 평균 {np.mean(hit):.2f}")

        # ── 오디션: 나레 베드 + 10:90 · 덕킹 0 ──
        bed = build_bed(sr)
        b = mono(cut)[:len(bed)]
        speech = np.abs(bed) > 10 ** (-45/20)
        speech = np.convolve(speech.astype(float), np.ones(int(0.1*sr)), "same") > 0
        E_n = float((bed[speech] ** 2).mean()); E_b = float((b[speech] ** 2).mean())
        gain = math.sqrt(E_n * SHARE / (1-SHARE) / max(E_b, 1e-18))
        mix = bed + b * gain
        wp = os.path.join(HERE, f"audition_{tag}.wav")
        wavfile.write(wp, sr, mix.astype(np.float32))
        run(["ffmpeg","-hide_banner","-v","error","-y","-i",wp,"-c:a","aac","-b:a","192k",
             os.path.join(HERE, f"audition_{tag}.m4a")])
        res[tag]["audition_gain_db"] = round(20*math.log10(gain), 2)
        res[tag]["speech_cover_pct"] = round(100*float(speech.mean()), 1)

    json.dump({"_격자": {"bpm": BPM, "bar_s": BAR_S, "bars": BARS, "total_s": TOTAL_S,
                        "total_f": N, "fps": FPS},
               "_나레배치_f": {k: v for k, v in NAR},
               "_주의": "수치는 후보 압축용. 결정은 ◆귀(편1 v3.4 선례)",
               "candidates": res},
              open(os.path.join(HERE, "cand_analysis.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)
    if res:
        print(f"\n나레 커버율 {list(res.values())[0]['speech_cover_pct']:.1f}% "
              f"(ep15 롱폼 76% · 이 편은 무나레 구간이 길다 = BGM 이 혼자 끄는 시간)")
    print("→ splice_*.wav · audition_*.m4a · cand_analysis.json  (후보 " + " ".join(res) + ")")

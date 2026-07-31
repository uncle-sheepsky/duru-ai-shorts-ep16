# -*- coding: utf-8 -*-
"""lufs_spread.py — 나레 라인 LUFS 스프레드 게이트(07단계) 정밀 측정기. 2026-07-29 신설.

왜 필요한가 (전부 실측 · 근거 = duru-ai/부록/오디오-믹스-사례.md §9):
  · ffmpeg `ebur128` 요약행 `I:` 는 **0.1 LU 격자로 반올림**된다 → 소수 자리 판정 불가.
  · ffmpeg `loudnorm print_format=json` 의 `input_i` 는 **BS.1770 통합값이 아니다** —
    3s 넘는 라인에서 어긋난다(실측 라인 최대 0.86 LU · 기준신호 0.75 LU).
    편11이 이 값으로 정적 게인을 계산해 `0.190 PASS` 를 냈으나 실제 스프레드는 **0.330 FAIL**이었다.
    ⛔스프레드 판정에 `input_i` 를 쓰지 마라.

그래서 여기선 BS.1770-4 를 직접 구현한다. 48kHz 리샘플 → 규격 표기 K-weighting 계수 →
400ms 블록(75% 오버랩) → 절대게이트 −70 LUFS → 상대게이트 −10 LU.
`--selftest` 로 1kHz −23 dBFS(RMS) 기준신호에 대해 −23.0 ± 0.05 를 먼저 확인한다(기저율 없는 게이트는 무효).

사용:
  <site-factory venv> lufs_spread.py <나레 디렉토리> [--glob "N*.wav"] [--gate 0.3] [--ebur128]
  <site-factory venv> lufs_spread.py --selftest
"""
import argparse
import glob as _glob
import os
import re
import subprocess
import sys

import numpy as np
from scipy.io import wavfile
from scipy.signal import lfilter, resample_poly

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

# ITU-R BS.1770-4 Tables 1·2 — 48 kHz 규격 표기 계수.
# ⚠RBJ 셸프 공식으로 fc/Q 에서 유도하면 1kHz 에서 0.25 dB 어긋난다. 표기 계수를 그대로 쓴다.
SHELF_B = np.array([1.53512485958697, -2.69169618940638, 1.19839281085285])
SHELF_A = np.array([1.0, -1.69065929318241, 0.73248077421585])
HPF_B = np.array([1.0, -2.0, 1.0])
HPF_A = np.array([1.0, -1.99004745483398, 0.99007225036621])
FS = 48000


def integrated_lufs(x, rate):
    """BS.1770-4 게이트 통합 라우드니스. x = float ndarray (n,) 또는 (n, ch)."""
    if x.ndim == 1:
        x = x[:, None]
    if rate != FS:
        from math import gcd
        g = gcd(FS, rate)
        x = resample_poly(x, FS // g, rate // g, axis=0)
    G = np.ones(x.shape[1])
    if x.shape[1] >= 5:
        G = np.array([1.0, 1.0, 1.0, 1.41, 1.41][:x.shape[1]])

    y = lfilter(SHELF_B, SHELF_A, x, axis=0)
    y = lfilter(HPF_B, HPF_A, y, axis=0)

    bs, hs = int(0.400 * FS), int(0.100 * FS)
    if len(y) < bs:
        return None
    nb = (len(y) - bs) // hs + 1
    z = np.empty((nb, y.shape[1]))
    for j in range(nb):
        z[j] = np.mean(y[j * hs: j * hs + bs] ** 2, axis=0)

    def loud(zz):
        with np.errstate(divide="ignore"):
            return -0.691 + 10 * np.log10(np.sum(G * zz, axis=-1))

    l = loud(z)
    m_abs = l > -70.0
    if not m_abs.any():
        return None
    m = m_abs & (l > loud(np.mean(z[m_abs], axis=0)) - 10.0)
    if not m.any():
        return None
    return float(loud(np.mean(z[m], axis=0)))


def read_wav(path):
    rate, x = wavfile.read(path)
    if x.dtype == np.int16:
        x = x.astype(np.float64) / 32768.0
    elif x.dtype == np.int32:
        x = x.astype(np.float64) / 2147483648.0
    else:
        x = x.astype(np.float64)
    return rate, x


def measure(path):
    rate, x = read_wav(path)
    return integrated_lufs(x, rate)


def ebur128(path):
    """대조용 — 파이프 실행 게이트가 쓰는 값(0.1 LU 격자)."""
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", path,
                        "-af", "ebur128=framelog=quiet", "-f", "null", "-"],
                       capture_output=True, text=True, encoding="utf-8", errors="replace")
    m = re.findall(r"I:\s*(-?\d+\.?\d*)\s*LUFS", r.stderr)
    return float(m[-1]) if m else None


def selftest():
    sr = 44100
    t = np.arange(int(sr * 20)) / sr
    x = 10 ** (-23 / 20) * np.sqrt(2) * np.sin(2 * np.pi * 1000 * t)   # RMS = −23 dBFS
    got = integrated_lufs(x, sr)
    ok = abs(got - (-23.0)) <= 0.05
    print(f"selftest 1kHz −23 dBFS(RMS) → {got:.3f} LUFS (기대 −23.0 ±0.05)  {'PASS' if ok else '★FAIL'}")
    return 0 if ok else 1


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("dir", nargs="?", help="나레 라인 디렉토리(예: nar/ · nar/proc/)")
    ap.add_argument("--glob", default="N*.wav")
    ap.add_argument("--gate", type=float, default=0.3, help="스프레드 임계(정본 = duru-ai/steps/07)")
    ap.add_argument("--ebur128", action="store_true", help="ffmpeg ebur128 값도 함께 출력(격자 대조)")
    ap.add_argument("--selftest", action="store_true")
    a = ap.parse_args()

    if a.selftest or not a.dir:
        return selftest()

    files = sorted(f for f in _glob.glob(os.path.join(a.dir, a.glob))
                   if not os.path.basename(f).startswith("_"))
    if not files:
        print(f"파일 없음: {os.path.join(a.dir, a.glob)}")
        return 2
    if selftest():
        print("★계측기 자기검증 실패 — 판정 중단")
        return 1

    rows = []
    for f in files:
        rows.append((os.path.basename(f), measure(f), ebur128(f) if a.ebur128 else None))
    print(f"\n{'라인':<14}{'BS.1770':>10}" + (f"{'ebur128':>10}" if a.ebur128 else ""))
    for n, v, e in rows:
        print(f"{n:<14}{v:>10.3f}" + (f"{e:>10.1f}" if a.ebur128 else ""))

    vals = [v for _, v, _ in rows if v is not None]
    sp = max(vals) - min(vals)
    lo = min(rows, key=lambda r: r[1])
    hi = max(rows, key=lambda r: r[1])
    print(f"\n라인 LUFS 스프레드 {sp:.3f} LU (게이트 ≤{a.gate}) → "
          f"{'PASS' if sp <= a.gate else '★FAIL'}")
    print(f"  최저 {lo[0]} {lo[1]:.3f} / 최고 {hi[0]} {hi[1]:.3f} · n={len(vals)}")
    return 0 if sp <= a.gate else 1


if __name__ == "__main__":
    sys.exit(main())

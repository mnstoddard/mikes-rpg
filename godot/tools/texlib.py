"""Seamless procedural texture helpers (numpy only). Every function returns arrays that tile."""
import numpy as np

def rng(seed): return np.random.default_rng(seed)

def fnoise(n, seed, scale, falloff=2.0, aniso=(1.0, 1.0)):
    """Tileable fractal noise: white noise filtered in frequency space. scale = feature size in px."""
    r = rng(seed)
    w = r.standard_normal((n, n))
    fy = np.fft.fftfreq(n)[:, None] / aniso[1]
    fx = np.fft.fftfreq(n)[None, :] / aniso[0]
    f = np.sqrt(fx * fx + fy * fy)
    f0 = 1.0 / scale
    amp = 1.0 / (1.0 + (f / f0) ** falloff)
    amp[0, 0] = 0
    out = np.real(np.fft.ifft2(np.fft.fft2(w) * amp))
    out -= out.mean(); out /= (out.std() + 1e-9)
    return out  # ~N(0,1)

def norm01(a):
    lo, hi = np.percentile(a, 1), np.percentile(a, 99)
    return np.clip((a - lo) / (hi - lo + 1e-9), 0, 1)

def blur(a, px):
    n = a.shape[0]
    fy = np.fft.fftfreq(n)[:, None]; fx = np.fft.fftfreq(n)[None, :]
    g = np.exp(-2 * (np.pi * px) ** 2 * (fx * fx + fy * fy))
    if a.ndim == 3:
        return np.stack([np.real(np.fft.ifft2(np.fft.fft2(a[..., c]) * g)) for c in range(a.shape[2])], -1)
    return np.real(np.fft.ifft2(np.fft.fft2(a) * g))

def voronoi(n, count, seed, jitter=1.0):
    """Tileable Worley noise. Returns F1, F2 (in px) and cell id per pixel."""
    r = rng(seed)
    pts = r.random((count, 2)) * n
    ys, xs = np.mgrid[0:n, 0:n].astype(np.float32)
    f1 = np.full((n, n), 1e9, np.float32); f2 = np.full((n, n), 1e9, np.float32)
    cid = np.zeros((n, n), np.int32)
    for i, (px, py) in enumerate(pts):
        dx = np.abs(xs - px); dx = np.minimum(dx, n - dx)
        dy = np.abs(ys - py); dy = np.minimum(dy, n - dy)
        d = np.sqrt(dx * dx + dy * dy)
        closer = d < f1
        f2 = np.where(closer, f1, np.minimum(f2, d))
        cid = np.where(closer, i, cid)
        f1 = np.where(closer, d, f1)
    return f1, f2, cid

def cell_values(cid, count, seed):
    return rng(seed).random(count)[cid]

def hexc(h):
    h = h.lstrip('#'); return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], np.float32) / 255.0

def ramp(t, stops):
    """t in 0..1 -> colour from [(pos, '#hex'), ...]."""
    t = np.clip(t, 0, 1)
    out = np.zeros(t.shape + (3,), np.float32)
    ps = [p for p, _ in stops]; cs = [hexc(c) for _, c in stops]
    for c in range(3):
        out[..., c] = np.interp(t, ps, [col[c] for col in cs])
    return out

def lerp(a, b, t):
    t = t[..., None] if (np.ndim(t) == 2 and np.ndim(a) == 3) else t
    return a + (b - a) * t

def shade(col, k):
    """Multiply colour by k (2D array) around 1."""
    return col * k[..., None]

def normal_from_height(h, strength):
    dx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * 0.5
    dy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * 0.5
    nx = -dx * strength; ny = dy * strength  # OpenGL (Y+) convention
    nz = np.ones_like(h)
    l = np.sqrt(nx * nx + ny * ny + nz * nz)
    return np.stack([nx / l, ny / l, nz / l], -1) * 0.5 + 0.5

def ao_from_height(h, radius, amount):
    d = h - blur(h, radius)
    return np.clip(1 + d * amount, 0.35, 1)

def periodic_lines(n, freq, axis=0, warp=None, sharp=1.0):
    ys, xs = np.mgrid[0:n, 0:n].astype(np.float32) / n
    c = ys if axis == 0 else xs
    if warp is not None: c = c + warp
    return 0.5 + 0.5 * np.cos(2 * np.pi * freq * c) ** 1 if sharp == 1 else (0.5 + 0.5 * np.cos(2 * np.pi * freq * c)) ** sharp

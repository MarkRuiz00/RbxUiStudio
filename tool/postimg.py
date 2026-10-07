"""Post-proceso de PNG para Roblox.
1. Tope 1024px por lado (Roblox reescala lo que pase de 1024 y lo hace peor).
2. Bleed de color en píxeles transparentes (como PixelFix): Roblox filtra la textura
   mezclando el RGB de los píxeles alfa=0 (negro) => halo oscuro en los bordes. Rellenamos ese
   RGB con el color del vecino opaco más cercano; el alfa no se toca.
Uso: python postimg.py <dir_con_png>
"""
import sys, os
import numpy as np
from PIL import Image

MAX = 1024


def bleed(a: np.ndarray, iters: int = 24) -> np.ndarray:
    rgb = a[..., :3].astype(np.float32)
    alpha = a[..., 3]
    known = alpha > 0
    if known.all() or not known.any():
        return a
    rgb[~known] = 0
    for _ in range(iters):
        if known.all():
            break
        acc = np.zeros_like(rgb)
        cnt = np.zeros(known.shape, np.float32)
        for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (-1, 1), (1, -1), (1, 1)):
            k = np.roll(known, (dy, dx), (0, 1))
            acc += np.roll(rgb, (dy, dx), (0, 1)) * k[..., None]
            cnt += k
        grow = (~known) & (cnt > 0)
        rgb[grow] = acc[grow] / cnt[grow][:, None]
        known = known | grow
    out = a.copy()
    out[..., :3] = np.clip(rgb, 0, 255).astype(np.uint8)
    out[..., 3] = alpha
    return out


def process(path: str) -> str:
    im = Image.open(path).convert('RGBA')
    note = ''
    if max(im.size) > MAX:
        s = MAX / max(im.size)
        size = (max(1, round(im.width * s)), max(1, round(im.height * s)))
        im = im.convert('RGBa').resize(size, Image.LANCZOS).convert('RGBA')
        note = f' -> {size[0]}x{size[1]}'
    arr = bleed(np.array(im))
    Image.fromarray(arr, 'RGBA').save(path, optimize=True)
    return note


if __name__ == '__main__':
    d = sys.argv[1]
    n = 0
    for f in sorted(os.listdir(d)):
        if f.lower().endswith('.png'):
            note = process(os.path.join(d, f))
            n += 1
            if note:
                print(f'{f}{note}')
    print(f'postimg: {n} PNG ok')

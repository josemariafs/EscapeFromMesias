"""Prepara el pin KB subterráneo a partir del arte adjunto.

Quita el fondo negro por flood-fill desde los bordes (no toca el negro
del círculo KB) y deja el mismo recorte 3:4 que kb-pin.png.
"""
from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = Path(__file__).resolve().parent / "assets" / "kb-underground-source.png"
DST = ROOT / "public" / "markers" / "kb-underground-pin.png"
OUT_SIZE = (120, 160)


def is_bg(r: int, g: int, b: int) -> bool:
    """Fondo negro del canvas, no el borde azul oscuro ni el círculo KB."""
    return max(r, g, b) <= 10 and b <= 12


def main() -> None:
    im = Image.open(SRC).convert("RGBA")
    w, h = im.size
    px = im.load()
    visited = [[False] * h for _ in range(w)]
    q: deque[tuple[int, int]] = deque()

    def enqueue(x: int, y: int) -> None:
        if visited[x][y]:
            return
        r, g, b, _a = px[x, y]
        if is_bg(r, g, b):
            visited[x][y] = True
            q.append((x, y))

    for x in range(w):
        enqueue(x, 0)
        enqueue(x, h - 1)
    for y in range(h):
        enqueue(0, y)
        enqueue(w - 1, y)

    while q:
        x, y = q.popleft()
        px[x, y] = (0, 0, 0, 0)
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < w and 0 <= ny < h:
                enqueue(nx, ny)

    # Franja de compresión pegada al recorte.
    for x in range(w):
        for y in range(h):
            r, g, b, a = px[x, y]
            if a == 0 or not is_bg(r, g, b):
                continue
            if any(
                0 <= nx < w and 0 <= ny < h and px[nx, ny][3] == 0
                for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1))
            ):
                px[x, y] = (0, 0, 0, 0)

    bbox = im.getbbox()
    if bbox is None:
        raise SystemExit("No opaque pixels after background removal")
    cropped = im.crop(bbox)
    cropped.thumbnail(OUT_SIZE, Image.Resampling.LANCZOS)

    canvas = Image.new("RGBA", OUT_SIZE, (0, 0, 0, 0))
    ox = (OUT_SIZE[0] - cropped.size[0]) // 2
    oy = (OUT_SIZE[1] - cropped.size[1]) // 2
    canvas.paste(cropped, (ox, oy), cropped)
    canvas.save(DST)
    print(f"wrote {DST} size={canvas.size} from {SRC.name} crop={cropped.size}")


if __name__ == "__main__":
    main()

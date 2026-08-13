from collections import deque
from pathlib import Path

from PIL import Image

src = Path(
    r"C:\Users\rames\.cursor\projects\c-Users-rames-Documents-Dev-EscapeFromGorditos\assets"
    r"\c__Users_rames_AppData_Roaming_Cursor_User_workspaceStorage_fa189198fbab3af6926ca77b52a7bdf9"
    r"_images_image-fbecdc53-be60-4ee9-b131-093b3479ea2a.png"
)
dst = Path(__file__).resolve().parents[1] / "public" / "brand" / "pvp-seasonal-icon.png"


def is_bg(r: int, g: int, b: int, a: int) -> bool:
    """Outside hexagon: near-black / dark fringe (not the teal border)."""
    if a == 0:
        return False
    # Real teal ring samples ~ (94, 130, 120) — keep those.
    if g >= 95 and g > r + 20:
        return False
    avg = (r + g + b) / 3
    mx = max(r, g, b)
    # Dark outside + compression fringe under the hexagon
    return avg <= 58 or mx <= 62


def main() -> None:
    im = Image.open(src).convert("RGBA")
    w, h = im.size
    px = im.load()
    visited = [[False] * h for _ in range(w)]
    q: deque[tuple[int, int]] = deque()

    for x in range(w):
        for y in (0, h - 1):
            r, g, b, a = px[x, y]
            if is_bg(r, g, b, a):
                q.append((x, y))
                visited[x][y] = True
    for y in range(h):
        for x in (0, w - 1):
            r, g, b, a = px[x, y]
            if is_bg(r, g, b, a) and not visited[x][y]:
                q.append((x, y))
                visited[x][y] = True

    removed = 0
    while q:
        x, y = q.popleft()
        r, g, b, a = px[x, y]
        if is_bg(r, g, b, a):
            px[x, y] = (0, 0, 0, 0)
            removed += 1
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < w and 0 <= ny < h and not visited[nx][ny]:
                rr, gg, bb, aa = px[nx, ny]
                if is_bg(rr, gg, bb, aa):
                    visited[nx][ny] = True
                    q.append((nx, ny))

    # Soften fringe: dark pixels next to transparency get reduced alpha
    for x in range(w):
        for y in range(h):
            r, g, b, a = px[x, y]
            if a == 0 or not is_bg(r, g, b, a):
                continue
            near_clear = False
            for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if 0 <= nx < w and 0 <= ny < h and px[nx, ny][3] == 0:
                    near_clear = True
                    break
            if near_clear:
                px[x, y] = (0, 0, 0, 0)
                removed += 1

    # Strip occasional bright artifact column on the far right.
    for x in range(max(0, w - 2), w):
        for y in range(h):
            px[x, y] = (0, 0, 0, 0)

    cropped = im.crop(im.getbbox())
    dst.parent.mkdir(parents=True, exist_ok=True)
    cropped.save(dst, "PNG")
    print(f"saved {dst} size={cropped.size} removed={removed}")


if __name__ == "__main__":
    main()

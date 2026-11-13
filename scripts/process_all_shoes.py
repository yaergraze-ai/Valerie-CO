import os
import glob
from collections import deque
from concurrent.futures import ProcessPoolExecutor
from PIL import Image, ImageDraw

SRC_DIR = r"c:\Users\hann\Downloads\solere-luxury-store-v4\solere-luxury\public\shoes\custom"
OUT_DIR = r"c:\Users\hann\Downloads\solere-luxury-store-v4\solere-luxury\public\shoes\transparent"

os.makedirs(OUT_DIR, exist_ok=True)

def process_single(args):
    src_path, out_path = args
    try:
        img = Image.open(src_path).convert("RGBA")
        w, h = img.size
        max_dim = 1000
        if max(w, h) > max_dim:
            scale = max_dim / max(w, h)
            img = img.resize((int(w * scale), int(h * scale)), Image.Resampling.LANCZOS)
            w, h = img.size

        pixels = img.load()
        samples = []
        for x in range(0, w, max(1, w // 25)):
            samples.append(pixels[x, 0][:3])
            samples.append(pixels[x, h - 1][:3])
        for y in range(0, h, max(1, h // 25)):
            samples.append(pixels[0, y][:3])
            samples.append(pixels[w - 1, y][:3])

        bg_r = sorted([s[0] for s in samples])[len(samples) // 2]
        bg_g = sorted([s[1] for s in samples])[len(samples) // 2]
        bg_b = sorted([s[2] for s in samples])[len(samples) // 2]
        bg_col = (bg_r, bg_g, bg_b)

        def color_dist(c1, c2):
            dr = c1[0] - c2[0]
            dg = c1[1] - c2[1]
            db = c1[2] - c2[2]
            return (dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11) ** 0.5 * 1.65

        tolerance = 32
        max_dist = tolerance * 1.35
        visited = bytearray(w * h)
        queue = deque()

        def try_seed(x, y):
            idx = y * w + x
            if visited[idx]:
                return
            c = pixels[x, y][:3]
            if color_dist(c, bg_col) <= max_dist * 1.15:
                visited[idx] = 1
                queue.append((x, y))

        for x in range(w):
            try_seed(x, 0)
            try_seed(x, h - 1)
        for y in range(h):
            try_seed(0, y)
            try_seed(w - 1, y)

        dirs = [(-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (1, -1), (-1, 1), (1, 1)]

        while queue:
            cx, cy = queue.popleft()
            for dx, dy in dirs:
                nx, ny = cx + dx, cy + dy
                if 0 <= nx < w and 0 <= ny < h:
                    nidx = ny * w + nx
                    if not visited[nidx]:
                        nr, ng, nb, _ = pixels[nx, ny]
                        if color_dist((nr, ng, nb), bg_col) <= max_dist:
                            visited[nidx] = 1
                            queue.append((nx, ny))

        for y in range(h):
            for x in range(w):
                if visited[y * w + x]:
                    pixels[x, y] = (0, 0, 0, 0)

        # Feather edge pixels
        feather_outer = max_dist * 1.5
        feather_inner = max_dist * 0.4
        for y in range(1, h - 1):
            for x in range(1, w - 1):
                idx = y * w + x
                if visited[idx]:
                    continue
                touches_bg = any(visited[(y + dy) * w + (x + dx)] for dx, dy in dirs)
                if touches_bg:
                    r, g, b, a = pixels[x, y]
                    dist = color_dist((r, g, b), bg_col)
                    if dist < feather_outer:
                        ratio = max(0.0, min(1.0, (dist - feather_inner) / max(1.0, feather_outer - feather_inner)))
                        pixels[x, y] = (r, g, b, int(a * ratio))

        # Filter out detached small components (e.g. MILLS logo, watermarks, dust)
        visited_comp = bytearray(w * h)
        components = []

        for y in range(h):
            for x in range(w):
                idx = y * w + x
                if visited_comp[idx] or pixels[x, y][3] < 20:
                    continue
                comp = []
                q = deque([(x, y)])
                visited_comp[idx] = 1
                while q:
                    px_cur, py_cur = q.popleft()
                    comp.append((px_cur, py_cur))
                    for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                        nx, ny = px_cur + dx, py_cur + dy
                        if 0 <= nx < w and 0 <= ny < h:
                            nidx = ny * w + nx
                            if not visited_comp[nidx] and pixels[nx, ny][3] >= 20:
                                visited_comp[nidx] = 1
                                q.append((nx, ny))
                components.append(comp)

        if components:
            max_len = max(len(c) for c in components)
            threshold = max(200, int(max_len * 0.12))
            for c in components:
                if len(c) < threshold:
                    for px, py in c:
                        pixels[px, py] = (0, 0, 0, 0)

        # Crop to shoe bbox
        bbox = img.getbbox()
        if bbox:
            shoe = img.crop(bbox)
        else:
            shoe = img

        # Compose on uniform 1000x1000 square canvas with brand hallmark
        canvas = Image.new("RGBA", (1000, 1000), (0, 0, 0, 0))
        sw, sh = shoe.size
        scale = min(840 / sw, 740 / sh)
        shoe_resized = shoe.resize((max(1, int(sw * scale)), max(1, int(sh * scale))), Image.Resampling.LANCZOS)
        rw, rh = shoe_resized.size
        canvas.paste(shoe_resized, ((1000 - rw) // 2, (1000 - rh) // 2 - 25), shoe_resized)

        # Brand signature on the image: 'SOLÈRE ATELIER'
        badge = Image.new("RGBA", (1000, 1000), (0, 0, 0, 0))
        bdraw = ImageDraw.Draw(badge)
        text = "S O L È R E   A T E L I E R"
        bdraw.text((500, 935), text, fill=(185, 155, 125, 175), anchor="ms")
        bdraw.line([(380, 955), (620, 955)], fill=(185, 155, 125, 110), width=1)

        final = Image.alpha_composite(canvas, badge)
        final.save(out_path, "PNG", optimize=True)
        return (os.path.basename(src_path), True, os.path.getsize(out_path))
    except Exception as e:
        return (os.path.basename(src_path), False, str(e))

def main():
    pattern = os.path.join(SRC_DIR, "shoe-*.*")
    files = sorted(glob.glob(pattern))
    tasks = []
    for f in files:
        base_name = os.path.splitext(os.path.basename(f))[0]
        out_file = os.path.join(OUT_DIR, f"{base_name}.png")
        tasks.append((f, out_file))

    print(f"Starting batch cutout for {len(tasks)} files across CPU cores...")
    workers = min(8, os.cpu_count() or 4)
    with ProcessPoolExecutor(max_workers=workers) as executor:
        results = list(executor.map(process_single, tasks))

    success = [r for r in results if r[1]]
    failed = [r for r in results if not r[1]]
    print(f"Batch completed: {len(success)}/{len(tasks)} succeeded, {len(failed)} failed.")
    for f in failed:
        print(f"Failed {f[0]}: {f[2]}")

if __name__ == "__main__":
    main()

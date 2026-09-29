"""Extract original painted figures, articulated parts, and repaired background patches."""

import base64
import argparse
import json
from io import BytesIO
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from prepare_assets import load_actors, load_source

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path, nargs="?")
    parser.add_argument("--inspect", type=Path)
    args = parser.parse_args()
    source = load_source(args.source)
    clean_source = source.copy()
    paper = np.asarray(source.crop((18900, 450, 18950, 510)), dtype=np.float32)
    grain = paper - cv2.GaussianBlur(paper, (0, 0), 1.6)
    actors = load_actors()
    atlas = Image.new("RGBA", (2048, 2048))
    cursor = [2, 2, 0]

    def pack(image):
        w, h = image.size
        if cursor[0] + w + 2 > atlas.width:
            cursor[0], cursor[1], cursor[2] = 2, cursor[1] + cursor[2] + 2, 0
        if cursor[1] + h + 2 > atlas.height:
            raise ValueError("Actor atlas is full")
        x, y = cursor[:2]
        atlas.paste(image, (x, y))
        cursor[0] += w + 2
        cursor[2] = max(cursor[2], h)
        return [x, y, w, h]

    def patch(polygons, pad=2):
        points = [point for polygon in polygons for point in polygon]
        x = int(min(p[0] for p in points)) - pad
        y = int(min(p[1] for p in points)) - pad
        right = int(max(p[0] for p in points)) + pad + 1
        bottom = int(max(p[1] for p in points)) + pad + 1
        image = source.crop((x, y, right, bottom)).convert("RGBA")
        mask = Image.new("L", image.size)
        draw = ImageDraw.Draw(mask)
        for polygon in polygons:
            draw.polygon([(px - x, py - y) for px, py in polygon], fill=255)
        mask = mask.filter(ImageFilter.GaussianBlur(.45))
        image.putalpha(mask)
        return image, [x, y, image.width, image.height]

    def bone(a, b, thickness):
        length = np.linalg.norm(np.array(b) - a)
        if length <= 0:
            raise ValueError("A skeleton bone must have nonzero length")
        return {"length": float(length), "width": thickness}

    manifests = []
    inspect = Image.new("RGB", (1400, ((len(actors) + 6) // 7) * 450), "#c7b38b")
    labels = ImageDraw.Draw(inspect)
    for index, actor in enumerate(actors):
        polygons = actor.get("outlines") or [actor["outline"]]
        surface = actor["action"] in ("carry", "ride", "amble")
        image, bounds = patch(polygons, pad=30 if surface else 12)
        x, y, w, h = bounds
        mask = np.asarray(image.getchannel("A"))
        erase = cv2.dilate((mask > 25).astype(np.uint8) * 255, np.ones((5, 5), np.uint8))
        original = np.asarray(source.crop((x, y, x + w, y + h)))
        repaired = cv2.inpaint(original, erase, 6, cv2.INPAINT_TELEA)
        # Restore the scan's silk grain inside the healed area, not a flat fill.
        yy, xx = np.indices((h, w))
        residual = grain[(yy + y) % grain.shape[0], (xx + x) % grain.shape[1]]
        interior = cv2.GaussianBlur((erase > 0).astype(np.float32), (0, 0), 1.0)
        repaired = np.clip(repaired.astype(np.float32) + residual * interior[:, :, None], 0, 255).astype(np.uint8)
        alpha = Image.fromarray(erase).filter(ImageFilter.GaussianBlur(1.0))
        repair_image = Image.fromarray(repaired).convert("RGBA")
        repair_image.putalpha(alpha)
        entry = {key: value for key, value in actor.items()
                 if key not in ("outline", "outlines", "head", "body", "arms", "legs")}
        if surface:
            # A pinned rectangular surface keeps faint ink, reins and background
            # continuous, avoiding destructive inpainting around large ensembles.
            image = clean_source.crop((x, y, x + w, y + h)).convert("RGBA")
            coverage = cv2.dilate((mask > 25).astype(np.uint8) * 255, np.ones((45, 45), np.uint8))
            image.putalpha(Image.fromarray(coverage).filter(ImageFilter.GaussianBlur(3)))
            entry["surface"] = True
            entry["contours"] = polygons
        else:
            entry["repair"] = {"src": pack(repair_image), "bounds": bounds}
            clean_source.paste(repair_image, (x, y), repair_image)
        entry["sprite"] = {"src": pack(image), "bounds": bounds}
        entry["arms"], entry["legs"] = [], []
        for name in ("arms", "legs"):
            for a, b, c, thickness in actor[name]:
                entry[name].append({
                    "joints": [a, b, c],
                    "upper": bone(a, b, thickness),
                    "lower": bone(b, c, thickness * .75),
                })
        manifests.append(entry)
        column, row = index % 7, index // 7
        scale = min(194 / w, 410 / h, 2)
        size = (round(w * scale), round(h * scale))
        crop = source.crop((x, y, x + w, y + h)).resize(size)
        clean = image.copy().resize(size)
        inspect.paste(crop, (column * 200, row * 450 + 30))
        inspect.paste(clean, (column * 200, row * 450 + 30), clean)
        labels.text((column * 200 + 2, row * 450 + 5), actor["id"], fill="black")
    actual_height = cursor[1] + cursor[2] + 2
    atlas = atlas.crop((0, 0, atlas.width, actual_height))
    buffer = BytesIO()
    atlas.save(buffer, "PNG", optimize=True)
    payload = {
        "image": "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode(),
        "size": list(atlas.size), "actors": manifests,
    }
    (ROOT / "assets" / "actors.js").write_text(
        "window.QINGMING_ACTORS = " + json.dumps(payload, separators=(",", ":")) + ";\n"
    )
    if args.inspect:
        args.inspect.mkdir(parents=True, exist_ok=True)
        atlas.save(args.inspect / "atlas.png")
        inspect.save(args.inspect / "selected.png")
    print(json.dumps({"actors": len(actors), "atlas": atlas.size, "bytes": buffer.tell()}))


if __name__ == "__main__":
    main()

"""Prepare overlapping image tiles and inspection sheets from the public-domain scan."""

import argparse
import base64
import json
from io import BytesIO
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from PIL import ImageFilter

ROOT = Path(__file__).resolve().parents[1]


def load_source(path=None):
    if path:
        image = Image.open(path).convert("RGB")
        return image.resize((25609, 1200), Image.Resampling.LANCZOS)
    # Reuse the shipped scan when the upstream image cannot be downloaded.
    image = Image.new("RGB", (25609, 1200))
    for index in range(9):
        payload = read_tile(index)
        tile = Image.open(BytesIO(base64.b64decode(payload["image"].split(",", 1)[1])))
        start = index * 3000
        left = max(0, start - 32)
        end = min(start + 3000, image.width)
        image.paste(tile.crop((start - left, 0, end - left, image.height)), (start, 0))
    return image


def read_tile(index):
    text = (ROOT / "assets" / f"tile-{index}.js").read_text()
    return json.loads(text.removeprefix(f"window.qingmingTile({index},").removesuffix(");\n"))


def load_actors():
    actors = json.loads((ROOT / "actors.json").read_text())
    groups = {}
    for actor in json.loads((ROOT / "processions.json").read_text()):
        key = actor.get("group", actor["id"])
        if key not in groups:
            groups[key] = {**actor, "id": key, "members": [actor["id"]]}
            continue
        group = groups[key]
        phase = actor.get("phase", 0) - group.get("phase", 0)
        group["legPhases"] += [value + phase for value in actor["legPhases"]]
        group.setdefault("legBends", [-group["nativeDirection"]] * len(group["legs"])).extend(
            actor.get("legBends", [-actor["nativeDirection"]] * len(actor["legs"])))
        for name in ("outlines", "arms", "legs", "flex"):
            group.setdefault(name, []).extend(actor.get(name, []))
        count = len(group["members"])
        group["root"] = [
            (group["root"][0] * count + actor["root"][0]) / (count + 1),
            max(group["root"][1], actor["root"][1]),
        ]
        group["members"].append(actor["id"])
    return actors + list(groups.values())


def encode(image, kind, **options):
    buffer = BytesIO()
    image.save(buffer, kind, **options)
    mime = "jpeg" if kind == "JPEG" else "png"
    return f"data:image/{mime};base64," + base64.b64encode(buffer.getvalue()).decode()


def create_mask(size, motion, actors=()):
    mask = Image.new("RGBA", size)
    water = Image.new("L", size)
    draw = ImageDraw.Draw(water)
    for polygon in motion["water"]:
        draw.polygon([tuple(p) for p in polygon], fill=255)
    water = water.filter(ImageFilter.GaussianBlur(7))
    layer = Image.new("RGBA", size, (0, 0, 166, 0))
    layer.putalpha(water)
    mask.paste(layer)
    for category, band in [("boats", 210), ("trees", 90), ("people", 26)]:
        for index, region in enumerate(motion[category]):
            if category == "people":
                cx, cy, width, height = region
                x, y = round(cx - width / 2), round(cy - height / 2)
            else:
                x, y, width, height = region["bounds"]
            xx, yy = np.meshgrid(np.linspace(0, 1, width), np.linspace(0, 1, height))
            patch = np.empty((height, width, 4), dtype=np.uint8)
            patch[:, :, 0] = np.rint(xx * 255)
            patch[:, :, 1] = np.rint(yy * 255)
            patch[:, :, 2] = band + index * 7 % 24
            if category == "people":
                # Rounded silhouettes feather to zero before touching neighboring figures.
                side = np.clip((0.5 - np.abs(xx - 0.5)) * 10, 0, 1)
                ends = np.clip(np.minimum(yy, 1 - yy) * 12, 0, 1)
                patch[:, :, 3] = np.rint(side * ends * 255)
                alpha = Image.fromarray(patch[:, :, 3])
            else:
                alpha = Image.new("L", (width, height))
                points = [(px - x, py - y) for px, py in region["polygon"]]
                ImageDraw.Draw(alpha).polygon(points, fill=255)
                alpha = alpha.filter(ImageFilter.GaussianBlur(5))
                patch[:, :, 3] = np.asarray(alpha)
            # Replace all channels together; zero-alpha pixels retain the underlying water.
            coverage = alpha.point(lambda value: 255 if value > 2 else 0)
            mask.paste(Image.fromarray(patch), (x, y), coverage)
    # An extracted subject must not also move in the underlying painting.
    for actor in actors:
        polygons = actor.get("outlines") or [actor["outline"]]
        points = [point for polygon in polygons for point in polygon]
        mask.paste((0, 0, 0, 0), (
            min(p[0] for p in points) - 8, min(p[1] for p in points) - 8,
            max(p[0] for p in points) + 9, max(p[1] for p in points) + 9,
        ))
    return mask


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path, nargs="?")
    parser.add_argument("--inspect", type=Path)
    parser.add_argument("--masks-only", action="store_true",
                        help="Preserve shipped JPEG payloads and update only motion masks")
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    output = root / "assets"
    output.mkdir(parents=True, exist_ok=True)
    image = load_source(args.source)
    height = 1200
    width = round(image.width * height / image.height)
    image = image.resize((width, height), Image.Resampling.LANCZOS)
    motion = json.loads((root / "motion.json").read_text())
    mask = create_mask((width, height), motion, load_actors())
    if not args.masks_only:
        image.resize((2134, 100), Image.Resampling.LANCZOS).save(
            output / "overview.jpg", quality=90
        )
    tiles = []
    step, overlap = 3000, 32
    for index, start in enumerate(range(0, width, step)):
        left, right = max(0, start - overlap), min(width, start + step + overlap)
        filename = f"tile-{index}.js"
        payload = {
            "image": read_tile(index)["image"] if args.masks_only else encode(
                image.crop((left, 0, right, height)),
                "JPEG", quality=94, subsampling=0, optimize=True,
            ),
            "mask": encode(mask.crop((left, 0, right, height)), "PNG", optimize=True),
        }
        (output / filename).write_text(
            f"window.qingmingTile({index}," + json.dumps(payload) + ");\n",
            encoding="ascii",
        )
        tiles.append({
            "src": f"assets/{filename}", "x": left, "width": right - left,
            "start": start, "end": min(width, start + step),
        })
    metadata = {"width": width, "height": height, "tiles": tiles}
    if not args.masks_only:
        (output / "tiles.js").write_text(
            "window.SCROLL_ASSETS = " + json.dumps(metadata, indent=2) + ";\n",
            encoding="utf-8",
        )
    if args.inspect:
        args.inspect.mkdir(parents=True, exist_ok=True)
        for start in range(0, width, 3000):
            crop = image.crop((start, 0, min(start + 3000, width), height))
            crop = crop.resize((crop.width // 2, height // 2))
            draw = ImageDraw.Draw(crop)
            for x in range(0, crop.width, 100):
                draw.line((x, 0, x, crop.height), fill=(140, 60, 40), width=1)
                draw.text((x + 3, 5), str(start + x * 2), fill="black")
            for y in range(100, 600, 100):
                draw.line((0, y, crop.width, y), fill=(140, 60, 40), width=1)
                draw.text((3, y + 3), str(y * 2), fill="black")
            crop.save(args.inspect / f"section-{start}.jpg", quality=95)
    print(json.dumps(metadata))


if __name__ == "__main__":
    main()

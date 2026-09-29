"""Create magnified contact sheets for selecting and rigging painted figures."""

import json
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
source = Image.open("/private/tmp/qingming-original.jpg").convert("RGB")
source = source.resize((25609, 1200), Image.Resampling.LANCZOS)
people = json.loads((ROOT / "motion.json").read_text())["people"]
out = Path("/private/tmp/qingming-rigs")
out.mkdir(exist_ok=True)
for start in range(0, len(people), 24):
    sheet = Image.new("RGB", (1200, 1020), "#e3d7bb")
    draw = ImageDraw.Draw(sheet)
    for local, (cx, cy, width, height) in enumerate(people[start:start + 24]):
        x, y = local % 6 * 200, local // 6 * 255
        box = (cx - max(35, width), cy - height * .65,
               cx + max(35, width), cy + height * .65)
        crop = source.crop(box)
        crop.thumbnail((194, 226), Image.Resampling.LANCZOS)
        crop = source.crop(box).resize(
            (round(source.crop(box).width * min(194 / source.crop(box).width, 226 / source.crop(box).height)),
             round(source.crop(box).height * min(194 / source.crop(box).width, 226 / source.crop(box).height))),
            Image.Resampling.NEAREST,
        )
        sheet.paste(crop, (x + (200 - crop.width) // 2, y + 25))
        draw.text((x + 6, y + 6), f"{start + local}: {cx},{cy} {width}x{height}", fill="black")
    sheet.save(out / f"people-{start}.jpg", quality=95)
print(len(people))
details = {
    "market": (1800, 450, 2520, 1160),
    "market-left": (800, 470, 1420, 1150),
    "gate": (3860, 530, 4410, 1180),
    "town": (6440, 900, 6800, 1200),
    "bridge-road": (12140, 380, 12770, 1080),
    "boat": (12920, 370, 13540, 800),
    "country": (18600, 360, 19620, 740),
    "country-road": (19750, 600, 20600, 1150),
    "east": (24200, 490, 24700, 860),
}
for name, bounds in details.items():
    crop = source.crop(bounds)
    draw = ImageDraw.Draw(crop)
    for x in range((bounds[0] // 50 + 1) * 50, bounds[2], 50):
        draw.line((x - bounds[0], 0, x - bounds[0], crop.height), fill="#c15544", width=1)
        draw.text((x - bounds[0] + 2, 3), str(x), fill="#16140d")
    for y in range((bounds[1] // 50 + 1) * 50, bounds[3], 50):
        draw.line((0, y - bounds[1], crop.width, y - bounds[1]), fill="#c15544", width=1)
        draw.text((2, y - bounds[1] + 2), str(y), fill="#16140d")
    crop.save(out / f"{name}.png")

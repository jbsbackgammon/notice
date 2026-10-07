from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
IMAGE_DIR = ROOT / "images"
OUT = ROOT / "assets" / "images.json"
EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"}

files = []
if IMAGE_DIR.exists():
    for path in IMAGE_DIR.rglob("*"):
        if path.is_file() and path.suffix.lower() in EXTENSIONS:
            files.append(path.relative_to(IMAGE_DIR).as_posix())

files.sort(key=lambda s: s.casefold())
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(files, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"Generated {OUT.relative_to(ROOT)} ({len(files)} image(s))")

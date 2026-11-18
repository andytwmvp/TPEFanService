#!/usr/bin/env python3
"""Assemble application fragments in their original shared scope."""
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "src" / "app"


def build():
    names = json.loads((SOURCE / "manifest.json").read_text(encoding="utf-8"))
    content = "".join((SOURCE / name).read_text(encoding="utf-8") for name in names)
    (ROOT / "assets" / "app.js").write_text(content, encoding="utf-8", newline="\n")
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    for name in ["app.js", "media.js", "styles.css"]:
        digest = hashlib.sha256((ROOT / "assets" / name).read_bytes()).hexdigest()[:12]
        html = re.sub(r"(\./assets/" + re.escape(name) + r")(?:\?v=[a-f0-9]+)?", r"\1?v=" + digest, html)
    (ROOT / "index.html").write_text(html, encoding="utf-8", newline="\n")


if __name__ == "__main__":
    build()

#!/usr/bin/env python3
"""Validate and assemble application fragments in their original shared scope."""
import argparse
import hashlib
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "src" / "app"


def syntax_check(content, label):
    node = shutil.which("node")
    if not node:
        raise ValueError("需要 Node.js 以驗證 JavaScript 語法。")
    result = subprocess.run([node, "--check"], input=content, capture_output=True)
    if result.returncode:
        # Do not print source lines: media.js contains large embedded assets.
        diagnostics = result.stderr.decode("utf-8", errors="replace").splitlines()
        reason = next((line for line in diagnostics if "SyntaxError:" in line), "語法檢查失敗")
        raise ValueError(f"{label}: {reason}")


def build(check=False):
    names = json.loads((SOURCE / "manifest.json").read_text(encoding="utf-8"))
    if (not isinstance(names, list) or not names
            or any(not isinstance(name, str) or Path(name).name != name
                   or not name.endswith(".js") for name in names)
            or len(set(names)) != len(names)):
        raise ValueError("manifest 必須列出不重複的 JavaScript 檔名。")
    if set(names) != {p.name for p in SOURCE.glob("*.js")}:
        raise ValueError("manifest 與 src/app 的 JavaScript 檔案不一致。")
    content = "".join((SOURCE / name).read_text(encoding="utf-8") for name in names).encode("utf-8")
    outputs = {ROOT / "assets" / "app.js": content}
    assets = {"app.js": content}
    for name in ["media.js", "styles.css"]:
        assets[name] = (ROOT / "assets" / name).read_bytes()
    for name in ["app.js", "media.js"]:
        syntax_check(assets[name], name)
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    for name, data in assets.items():
        digest = hashlib.sha256(data).hexdigest()[:12]
        pattern = r"(\./assets/" + re.escape(name) + r")(?:\?v=[a-f0-9]+)?(?=[\"'])"
        html, count = re.subn(pattern, lambda match: match[1] + "?v=" + digest, html)
        if count != 1:
            raise ValueError(f"index.html 必須引用 {name} 恰好一次。")
    outputs[ROOT / "index.html"] = html.encode("utf-8")
    stale = [path for path, data in outputs.items() if not path.exists() or path.read_bytes() != data]
    if check:
        if stale:
            raise ValueError("部署產物未同步，請執行 python3 scripts/build.py：" +
                             ", ".join(str(path.relative_to(ROOT)) for path in stale))
        return
    # All validation finishes before any deployment file is changed.
    for path in stale:
        path.write_bytes(outputs[path])


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="唯讀檢查部署產物與資源雜湊")
    args = parser.parse_args()
    try:
        build(check=args.check)
    except (OSError, ValueError) as error:
        print(f"組裝失敗：{error}", file=sys.stderr)
        sys.exit(1)

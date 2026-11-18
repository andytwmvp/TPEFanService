#!/usr/bin/env python3
"""Validate and assemble application fragments in their original shared scope."""
import argparse
import hashlib
import json
import os
import re
import shutil
import stat
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


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


def assemble(source):
    """Read the complete ordered source manifest without touching outputs."""
    names = json.loads((source / "manifest.json").read_text(encoding="utf-8"))
    if (not isinstance(names, list) or not names
            or any(not isinstance(name, str) or Path(name).name != name
                   or not name.endswith(".js") for name in names)
            or len(set(names)) != len(names)):
        raise ValueError("manifest 必須列出不重複的 JavaScript 檔名。")
    if set(names) != {p.name for p in source.glob("*.js")}:
        raise ValueError("manifest 與 src/app 的 JavaScript 檔案不一致。")
    return "".join((source / name).read_text(encoding="utf-8") for name in names).encode("utf-8")


def render_html(html, assets):
    """Render asset fingerprints from validated contents, without filesystem writes."""
    for name, data in assets.items():
        digest = hashlib.sha256(data).hexdigest()[:12]
        pattern = r"(\./assets/" + re.escape(name) + r")(?:\?v=[a-f0-9]+)?(?=[\"'])"
        html, count = re.subn(pattern, lambda match: match[1] + "?v=" + digest, html)
        if count != 1:
            raise ValueError(f"index.html 必須引用 {name} 恰好一次。")
    return html.encode("utf-8")


def prepare_outputs(root):
    """Assemble and validate every input before producing a deployment write plan."""
    assets = {"app.js": assemble(root / "src" / "app")}
    for name in ["media.js", "styles.css"]:
        assets[name] = (root / "assets" / name).read_bytes()
    for name in ["app.js", "media.js"]:
        syntax_check(assets[name], name)
    html = render_html((root / "index.html").read_text(encoding="utf-8"), assets)
    return {root / "assets" / "app.js": assets["app.js"], root / "index.html": html}


def build(check=False, root=ROOT):
    outputs = prepare_outputs(root)
    stale = [path for path, data in outputs.items() if not path.exists() or path.read_bytes() != data]
    if check:
        if stale:
            raise ValueError("部署產物未同步，請執行 python3 scripts/build.py：" +
                             ", ".join(str(path.relative_to(root)) for path in stale))
        return
    # Stage all contents before replacing files; each replacement is atomic.
    staged = []
    try:
        for path in stale:
            with tempfile.NamedTemporaryFile(dir=path.parent, prefix=".build-", delete=False) as temp:
                staged.append((Path(temp.name), path))
                temp.write(outputs[path])
            os.chmod(temp.name, stat.S_IMODE(path.stat().st_mode) if path.exists() else 0o644)
        for temporary, path in staged:
            os.replace(temporary, path)
    finally:
        for temporary, _ in staged:
            temporary.unlink(missing_ok=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="唯讀檢查部署產物與資源雜湊")
    args = parser.parse_args()
    try:
        build(check=args.check)
    except (OSError, ValueError) as error:
        print(f"組裝失敗：{error}", file=sys.stderr)
        sys.exit(1)

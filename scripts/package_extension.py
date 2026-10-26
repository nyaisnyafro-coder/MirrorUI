"""Builds the Chrome Web Store upload: dist/mirrorui-<version>.zip with the extension folder's contents.

    python scripts/package_extension.py

Checks first that every file the manifest and the service worker refer to is there, that the icons have the
sizes their names say, and that no code is loaded from the network (store policy: no remote code).
"""
import json
import re
import struct
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EXT = ROOT / 'extension'
DIST = ROOT / 'dist'
SKIP = {'.DS_Store', 'Thumbs.db', 'desktop.ini'}


def png_size(path):
    with open(path, 'rb') as f:
        head = f.read(24)
    return struct.unpack('>II', head[16:24])


def check(manifest):
    problems = []
    if len(manifest.get('description', '')) > 132:
        problems.append('description is longer than 132 characters')
    refs = list(manifest.get('icons', {}).values()) + [manifest['background']['service_worker']]
    refs += manifest.get('sandbox', {}).get('pages', [])
    refs += [r for war in manifest.get('web_accessible_resources', []) for r in war['resources']]
    # the toolbar scripts the service worker injects
    background = (EXT / manifest['background']['service_worker']).read_text(encoding='utf-8')
    refs += re.findall(r"'((?:lib|toolbar)/[\w-]+\.js)'", background)
    for page in ('results.html', 'preview.html'):
        refs += re.findall(r'(?:src|href)="([^"#:]+)"', (EXT / page).read_text(encoding='utf-8'))
    for ref in sorted(set(refs)):
        if not (EXT / ref).is_file():
            problems.append(f'missing file: {ref}')
    for size, ref in manifest.get('icons', {}).items():
        if (EXT / ref).is_file() and png_size(EXT / ref) != (int(size), int(size)):
            problems.append(f'{ref} is {png_size(EXT / ref)}, not {size}×{size}')
    for path in EXT.rglob('*'):
        if path.suffix in ('.js', '.html') and 'vendor' not in path.parts:
            text = path.read_text(encoding='utf-8')
            for m in re.finditer(r'<script[^>]+src="(https?:[^"]+)"|import\(\s*["\'](https?:[^"\']+)', text):
                # generated documents may point at the Tailwind CDN; the extension itself must not load it
                if 'compile.js' not in path.name:
                    problems.append(f'{path.relative_to(EXT)} loads remote code: {m.group(1) or m.group(2)}')
            if re.search(r'\beval\(|new Function\(', text):
                problems.append(f'{path.relative_to(EXT)} uses eval / new Function')
    return problems


def main():
    manifest = json.loads((EXT / 'manifest.json').read_text(encoding='utf-8'))
    problems = check(manifest)
    if problems:
        print('Not packaged:\n  ' + '\n  '.join(problems))
        sys.exit(1)
    DIST.mkdir(exist_ok=True)
    out = DIST / f'mirrorui-{manifest["version"]}.zip'
    files = sorted(p for p in EXT.rglob('*') if p.is_file() and p.name not in SKIP and not p.name.startswith('.'))
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
        for p in files:
            z.write(p, p.relative_to(EXT).as_posix())
    print(f'{out.relative_to(ROOT)}: {len(files)} files, {out.stat().st_size / 1024:.0f} KB')


if __name__ == '__main__':
    main()

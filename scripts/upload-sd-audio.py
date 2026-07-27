#!/usr/bin/env python3
"""Upload Satsang Diksha audio (Gujarati + Sanskrit mp3s) to R2 via the
Cloudflare REST API. Layout: satsang-diksha-audio/{gujarati,sanskrit}/shlok-N.mp3
Resumable (skips objects already present). Run with the PIL-free system python."""
import importlib.util, json, os, re, subprocess, sys, time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.expanduser('~/Desktop/Satsang Diksha Audio')
LANGS = {'gujarati': 'Gujarati', 'sanskrit': 'Sanskrit Vedic'}
spec = importlib.util.spec_from_file_location('mig', os.path.join(ROOT, 'scripts', 'migrate-sd-r2.py'))
mig = importlib.util.module_from_spec(spec)
src = open(os.path.join(ROOT, 'scripts', 'migrate-sd-r2.py')).read().replace(
    "if __name__ == '__main__':\n    main()", '')
exec(compile(src, 'mig', 'exec'), mig.__dict__)

def put_mp3(key, path):
    last = ''
    for attempt in range(4):
        out = subprocess.run(['curl', '-s', '-X', 'PUT', f"{mig.API}/objects/{key}", *mig.AUTH,
                              '-H', 'Content-Type: audio/mpeg', '--data-binary', f'@{path}'],
                             capture_output=True, text=True).stdout
        try:
            d = json.loads(out)
        except ValueError:
            last = out[:120]; time.sleep(8 * (attempt + 1)); continue
        if d.get('success'):
            return int((d.get('result') or {}).get('size') or -1)
        last = str(d.get('errors')); time.sleep(8 * (attempt + 1))
    raise RuntimeError(f"PUT {key}: {last}")

def main():
    done = mig.r2_existing()
    total = up = 0
    for lang, folder in LANGS.items():
        d = os.path.join(SRC, folder)
        for f in sorted(os.listdir(d)):
            m = re.match(r'Shlok_0*(\d+)\.mp3$', f)
            if not m: continue
            n = int(m.group(1)); total += 1
            key = f'satsang-diksha-audio/{lang}/shlok-{n}.mp3'
            if key in done: continue
            path = os.path.join(d, f)
            size = os.path.getsize(path)
            stored = put_mp3(key, path)
            if stored != size:
                raise RuntimeError(f'{key}: local {size} != stored {stored}')
            up += 1
            if up % 25 == 0: print(f'  {up} uploaded ({lang} #{n})', flush=True)
    print(f'done. {up} uploaded, {total} total keys.', flush=True)

if __name__ == '__main__':
    main()

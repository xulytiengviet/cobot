"""Download and verify version-pinned AI assets for same-origin hosting."""
import hashlib
import json
from pathlib import Path
from urllib.request import urlopen

root = Path(__file__).resolve().parents[1]
target = root / 'web/vendor/mediapipe'
target.mkdir(parents=True, exist_ok=True)
for item in json.loads((root / 'scripts/vision-assets.json').read_text()):
    destination = target / item['file']
    if destination.exists() and hashlib.sha256(destination.read_bytes()).hexdigest() == item['sha256']:
        continue
    for attempt in range(3):
        try:
            with urlopen(item['url'], timeout=60) as response:
                data = response.read()
            if hashlib.sha256(data).hexdigest() != item['sha256']:
                raise RuntimeError('Checksum mismatch: ' + item['file'])
            destination.write_bytes(data)
            print('Verified', item['file'], len(data))
            break
        except Exception:
            if attempt == 2:
                raise

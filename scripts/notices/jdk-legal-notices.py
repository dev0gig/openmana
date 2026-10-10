#!/usr/bin/env python3
"""Collects the original legal/ files of every JDK module that ships types in
the engine module (notices/licenses/openjdk-runtime-modules.txt).

Which modules: the JDK types of the license evidence written by
engine/scripts/sbom/inventory.py evidence (their src.zip paths start with the
module name). The texts: <java-home>/legal/<module>/* of the GraalVM CE home
the engine was built with (jlinked from labsjdk-ce), byte for byte; each file
is headed by its path and the SHA-256 of its original bytes.

  python3 -I scripts/notices/jdk-legal-notices.py <license-evidence.json> <java-home> > out.txt
"""
import hashlib
import json
import sys
from pathlib import Path


def main(evidence, java_home):
    data = json.loads(Path(evidence).read_text())
    modules = sorted({row['source'].split(':', 1)[1].split('/', 1)[0]
                      for row in data['types'].values() if row['source'].startswith('src.zip:')})
    legal = Path(java_home) / 'legal'
    out = []
    for module in modules:
        directory = legal / module
        if not directory.is_dir():
            raise SystemExit(f'no legal/ directory for shipped module {module}')
        for file in sorted(directory.iterdir()):
            raw = file.read_bytes()
            try:
                text = raw.decode('utf-8')
                note = 'UTF-8, text unchanged.'
            except UnicodeDecodeError:
                text = raw.decode('iso-8859-1')
                note = 'Decoded from ISO-8859-1, text unchanged.'
            out += [f'===== legal/{module}/{file.name} =====',
                    f'Original bytes SHA-256: {hashlib.sha256(raw).hexdigest()}', note, '', text.rstrip('\n'), '']
    sys.stdout.write('\n'.join(out))


if __name__ == '__main__':
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(*sys.argv[1:])

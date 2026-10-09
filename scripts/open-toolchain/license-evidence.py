#!/usr/bin/env python3
"""License evidence for an engine built with the OPEN toolchain (Prompt 34).

Reads the class-level SBOM that native-image wrote for the build and, for every
type that the toolchain (JDK or GraalVM) put into the module, looks up the
source file at the pinned state and classifies its license header:

  JDK types       src.zip of the labsjdk-ce the builder ran on (<module>/<pkg>/<File>.java)
  GraalVM types   the oracle/graal checkout at the pinned commit (any */src/*/src/<pkg>/<File>.java)

A nested type ($) belongs to its top-level type; a top-level type declared in
another file of its package is found by its declaration. Types of Forge,
OpenMana and their Maven libraries are not toolchain types; the app's notices
check (vite/notices.ts) attributes them through the fat JAR as before.
Class names alone prove nothing: a type counts as open only when its source
file exists at the pinned state and carries a GPLv2 + Classpath Exception,
UPL-1.0 or Apache-2.0 header (or is shaded Guava/Jimfs, Apache-2.0, built
from the Maven artifacts mx pins).

Also checks the launcher: every Oracle license header in it, and that the
closed Enterprise JS file (binary-load.js) is absent.

  python3 -I license-evidence.py <build-dir> <graal-checkout> <jdk-home> > license-evidence.json
"""
import json
import re
import sys
import zipfile
from collections import Counter, defaultdict
from pathlib import Path

HEADER_LINES = 40
KIND_RE = r'(?:class|interface|enum|record|@interface)'


def sbom_types(component):
    found = {p['value'] for p in component.get('properties', [])
             if p['name'] in ('class', 'interface', 'annotation')}
    for child in component.get('components', []):
        found |= sbom_types(child)
    return found


def classify(text):
    head = '\n'.join(text.splitlines()[:HEADER_LINES])
    if 'Classpath' in head and 'GNU General Public License' in head:
        return 'GPL-2.0-only WITH Classpath-exception-2.0'
    if 'Universal Permissive License' in head or 'UPL' in head:
        return 'UPL-1.0'
    if 'Apache License' in head:
        return 'Apache-2.0'
    if 'GNU General Public License' in head:
        return 'GPL (no Classpath Exception)'
    return 'unknown'


class Sources:
    """package -> {file name -> text getter} for one source tree."""

    def __init__(self):
        self.by_package = defaultdict(dict)

    def find(self, type_name):
        top = type_name.split('$', 1)[0]
        package, _, simple = top.rpartition('.')
        files = self.by_package.get(package)
        if not files:
            return None
        if simple + '.java' in files:
            return files[simple + '.java']
        pattern = re.compile(r'\b' + KIND_RE + r'\s+' + re.escape(simple) + r'\b')
        for entry in files.values():
            if pattern.search(entry[1]()):
                return entry
        return None


def jdk_sources(jdk_home):
    src = Sources()
    archive = zipfile.ZipFile(Path(jdk_home) / 'lib' / 'src.zip')
    for name in archive.namelist():
        if not name.endswith('.java') or name.count('/') < 2:
            continue
        module, rest = name.split('/', 1)
        package = rest.rsplit('/', 1)[0].replace('/', '.')
        src.by_package[package][rest.rsplit('/', 1)[1]] = (
            f'src.zip:{name}', (lambda n=name: archive.read(n).decode('utf-8', 'replace')))
    return src


def graal_sources(checkout):
    src = Sources()
    root = Path(checkout)
    for path in root.glob('*/src/*/src/**/*.java'):
        parts = path.relative_to(root).parts
        package = '.'.join(parts[4:-1])
        src.by_package[package].setdefault(
            path.name, (str(path.relative_to(root)), (lambda p=path: p.read_text('utf-8', 'replace'))))
    return src


def main(build, checkout, jdk_home):
    build = Path(build)
    sbom = json.loads((build / 'report/engine-sbom.class-level.json').read_text())
    components = {}
    owner = {}
    for c in sbom['components']:
        ref = c.get('bom-ref') or c.get('name')
        types = sbom_types(c)
        components[ref] = {'group': c.get('group'), 'name': c.get('name'), 'version': c.get('version'), 'types': len(types)}
        for t in types:
            owner[t] = ref
    jdk = jdk_sources(jdk_home)
    graal = graal_sources(checkout)
    rows = {}
    licenses = Counter()
    by_component = defaultdict(Counter)
    toolchain_types = 0
    for t in sorted(owner):
        if t.startswith('org.graalvm.shadowed.com.google.'):
            where, lic = 'shaded Guava/Jimfs (Maven artifacts pinned by mx)', 'Apache-2.0'
        else:
            hit = jdk.find(t) or graal.find(t)
            if hit is None:
                continue  # Forge, OpenMana or a Maven library: not a toolchain type
            where, lic = hit[0], classify(hit[1]())
        toolchain_types += 1
        licenses[lic] += 1
        by_component[owner[t]][lic] += 1
        rows[t] = {'component': owner[t], 'source': where, 'license': lic}
    launcher = (build / 'dist/openmana-engine.js').read_text('utf-8', 'replace')
    result = {
        'format': 'openmana-open-license-evidence/1',
        'graalCommit': None,
        'sbomTypes': len(owner),
        'components': components,
        'toolchainTypes': toolchain_types,
        'toolchainLicenses': dict(licenses),
        'toolchainByComponent': {k: dict(v) for k, v in sorted(by_component.items())},
        'notOpen': {t: r for t, r in rows.items() if r['license'] not in (
            'GPL-2.0-only WITH Classpath-exception-2.0', 'UPL-1.0', 'Apache-2.0')},
        'launcher': {
            'classpathExceptionHeaders': launcher.count('"Classpath" exception'),
            'oracleProprietaryHeaders': launcher.count('ORACLE PROPRIETARY'),
            'binaryLoadJs': 'binary-load' in launcher,
        },
        'types': rows,
    }
    head = Path(checkout) / '.git' / 'HEAD'
    if head.exists():
        result['graalCommit'] = head.read_text().strip()
    json.dump(result, sys.stdout, indent=1, sort_keys=False)
    sys.stdout.write('\n')


if __name__ == '__main__':
    if len(sys.argv) != 4:
        sys.exit(__doc__)
    main(*sys.argv[1:])

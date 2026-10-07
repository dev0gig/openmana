#!/usr/bin/env python3
"""Inventory the selected image, not its (much larger) build classpath.

SBOM-attributed runtime modules retain their compiler attribution. Unattributed
types are matched to original dependency JAR entries AND to the fat JAR bytes.
All classes/interfaces/annotations must have an owner; ambiguity is an error.
No license is inferred from a package prefix. Run after engine-lock verification.
"""
import argparse
import hashlib
import json
import re
from pathlib import Path
import zipfile


def sha(data):
    return hashlib.sha256(data).hexdigest()


def types(component):
    found = {p['value'] for p in component.get('properties', [])
             if p['name'] in ('class', 'interface', 'annotation')}
    for child in component.get('components', []):
        found.update(types(child))
    return found


def inventory(build, maven):
    manifest = json.loads((build / 'dist/engine-manifest.json').read_text())
    for name, facts in manifest['artefacts'].items():
        data = (build / 'dist' / name).read_bytes()
        if len(data) != facts['bytes'] or sha(data) != facts['sha256']:
            raise ValueError(f'Engine hash mismatch: {name}')
    sbom_path = build / 'report/engine-sbom.class-level.json'
    sbom = json.loads(sbom_path.read_text())
    all_types = types(sbom)
    if len(all_types) < 1000:
        raise ValueError('Missing class-level SBOM')
    forbidden = ('org.jupnp.', 'io.netty.', 'org.eclipse.jetty.', 'javax.servlet.')
    if any(t.startswith(forbidden) for t in all_types):
        raise ValueError('Forbidden network/CDDL type in shipped image')
    owners = {}
    for c in sbom['components']:
        if c.get('group') and c.get('components'):
            for t in types(c):
                if t in owners:
                    raise ValueError(f'Ambiguous SBOM type: {t}')
                owners[t] = c['bom-ref'].removeprefix('Oracle:')
    unassigned = all_types - owners.keys()
    original_jars = {}
    with zipfile.ZipFile(build / 'jvm/openmana-engine-jvm.jar') as fat:
        fat_names = set(fat.namelist())
        # Read the original dependency versions preserved inside this build.
        coordinates = set()
        for n in fat_names:
            if n.endswith('/pom.properties'):
                props = dict(line.split('=', 1) for line in fat.read(n).decode().splitlines()
                             if '=' in line and not line.startswith('#'))
                coordinates.add((props['groupId'], props['artifactId'], props['version']))
        # These dependencies have no pom.properties. Their exact versions must
        # come from the reviewed policy, and are still verified by class bytes.
        policy = json.loads((Path(__file__).parents[2] / 'notices/policy.json').read_text())
        documentation = (Path(__file__).parents[2] / 'engine/NOTICES.md').read_text()
        overrides = json.loads(re.search(r'```json\n(.*?)\n```', documentation, re.S).group(1))
        for coordinate in policy['unattributedDependencies']:
            parts = tuple(coordinate.split(':'))
            if not any(c[:2] == parts[:2] for c in coordinates):
                coordinates.add(parts)
        for coordinate in overrides['unattributedDependencies']:
            parts = tuple(coordinate.split(':'))
            coordinates = {c for c in coordinates if c[:2] != parts[:2]}
            coordinates.add(parts)
        candidates = {}
        for group, artifact, version in sorted(coordinates):
            jar = maven / group.replace('.', '/') / artifact / version / f'{artifact}-{version}.jar'
            if not jar.exists():
                # Forge/bridge were built locally, not installed in Maven.
                if group in ('forge', 'org.openmana'):
                    continue
                # Classifier-only native JARs may not exist at this filename.
                # No skipped dependency can disappear silently: the final
                # ownership check rejects every remaining non-project type.
                continue
            coordinate = f'{group}:{artifact}:{version}'
            matches = set()
            with zipfile.ZipFile(jar) as z:
                for entry in z.namelist():
                    if not entry.endswith('.class'):
                        continue
                    t = entry[:-6].replace('/', '.')
                    if t in unassigned and entry in fat_names and z.read(entry) == fat.read(entry):
                        candidates.setdefault(t, []).append(coordinate)
                        matches.add(t)
            if matches:
                original_jars[coordinate] = sha(jar.read_bytes())
        for t, choices in candidates.items():
            if len(choices) != 1:
                raise ValueError(f'Ambiguous original JAR for {t}: {choices}')
            owners[t] = choices[0]
        for t in all_types - owners.keys():
            if t.startswith('forge.'):
                owners[t] = f'forge:forge:{manifest["forge"]["commit"]}'
            elif t.startswith('org.openmana.'):
                owners[t] = 'org.openmana:openmana-engine:0.1.0'
            else:
                raise ValueError(f'Unattributed shipped type: {t}')
    components = {}
    for t, owner in sorted(owners.items()):
        components.setdefault(owner, []).append(t)
    return {
        'format': 'openmana-notices-engine/1',
        'manifestSha256': sha((build / 'dist/engine-manifest.json').read_bytes()),
        'sbomSha256': sha(sbom_path.read_bytes()),
        'fatJarSha256': sha((build / 'jvm/openmana-engine-jvm.jar').read_bytes()),
        'forge': manifest['forge'], 'toolchain': manifest['toolchain'],
        'resourcesSha256': manifest['resources']['sha256'],
        'typeCount': len(all_types), 'forbiddenTypes': [],
        'originalJars': original_jars,
        'components': components,
        # Launcher includes Oracle notices; preserve them verbatim as well.
        'launcherSha256': manifest['artefacts']['openmana-engine.js']['sha256'],
    }


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('build', type=Path)
    p.add_argument('--maven', type=Path, default=Path.home() / '.m2/repository')
    p.add_argument('--out', type=Path, default=Path(__file__).parents[2] / 'notices/engine-inventory.json')
    a = p.parse_args()
    result = inventory(a.build.resolve(), a.maven.resolve())
    a.out.write_text(json.dumps(result, indent=2, ensure_ascii=False) + '\n')
    print(f'{result["typeCount"]} types, {len(result["components"])} components; no network/CDDL types')

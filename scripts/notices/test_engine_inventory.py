"""Negative tests for image ownership, including non-class CDDL types."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
import zipfile

spec = importlib.util.spec_from_file_location('engine_inventory', Path(__file__).with_name('engine-inventory.py'))
engine_inventory = importlib.util.module_from_spec(spec)
spec.loader.exec_module(engine_inventory)


class EngineInventoryTests(unittest.TestCase):
    def build(self, root, extra=None):
        for directory in ('dist', 'report', 'jvm', 'maven'):
            (root / directory).mkdir()
        manifest = {'artefacts': {'openmana-engine.js': {'bytes': 0, 'sha256': engine_inventory.sha(b'')}},
                    'forge': {'commit': 'test-pin'}, 'toolchain': {}, 'resources': {'sha256': 'test-resources'}}
        (root / 'dist/engine-manifest.json').write_text(json.dumps(manifest))
        (root / 'dist/openmana-engine.js').write_bytes(b'')
        properties = [{'name': 'class', 'value': f'forge.Card{i}'} for i in range(1000)]
        if extra:
            properties.append(extra)
        (root / 'report/engine-sbom.class-level.json').write_text(json.dumps({'components': [{'properties': properties}]}))
        with zipfile.ZipFile(root / 'jvm/openmana-engine-jvm.jar', 'w'):
            pass

    def test_interface_and_annotation_types_are_counted(self):
        for kind in ('interface', 'annotation'):
            with self.subTest(kind=kind), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                self.build(root, {'name': kind, 'value': 'forge.AdditionalType'})
                result = engine_inventory.inventory(root, root / 'maven')
                self.assertEqual(result['typeCount'], 1001)
                self.assertIn('forge.AdditionalType', result['components']['forge:forge:test-pin'])

    def test_cddl_interface_cannot_hide_behind_class_only_analysis(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.build(root, {'name': 'interface', 'value': 'org.jupnp.UpnpService'})
            with self.assertRaisesRegex(ValueError, 'Forbidden network/CDDL'):
                engine_inventory.inventory(root, root / 'maven')

    def test_unknown_dependency_cannot_be_dropped(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.build(root, {'name': 'class', 'value': 'new.library.Unknown'})
            with self.assertRaisesRegex(ValueError, 'Unattributed shipped type'):
                engine_inventory.inventory(root, root / 'maven')

    def test_engine_bytes_must_match_manifest(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.build(root)
            (root / 'dist/openmana-engine.js').write_bytes(b'changed')
            with self.assertRaisesRegex(ValueError, 'Engine hash mismatch'):
                engine_inventory.inventory(root, root / 'maven')


if __name__ == '__main__':
    unittest.main()

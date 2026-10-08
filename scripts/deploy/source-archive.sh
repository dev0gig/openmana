#!/usr/bin/env bash
# Complete Corresponding Source of the current commit (prompt 31, SOURCE.md):
# the OpenMana tree plus the Forge submodule's tree at its gitlink - `git
# archive` alone leaves the submodule empty. Usage:
#
#   bash scripts/deploy/source-archive.sh <output-directory>
#
# Writes openmana-source-<commit>.tar.gz and its .sha256 next to it. The
# working tree must be clean and the Forge checkout must be the gitlink.
set -euo pipefail
out="$(realpath "${1:?output directory}")"
root="$(git rev-parse --show-toplevel)"
cd "$root"
[ -z "$(git status --porcelain)" ] || { echo "Working tree is not clean; commit first." >&2; exit 1; }
commit="$(git rev-parse HEAD)"
pin="$(git ls-tree HEAD engine/forge | awk '{print $3}')"
[ "$(git -C engine/forge rev-parse HEAD)" = "$pin" ] || { echo "engine/forge is not at its gitlink $pin" >&2; exit 1; }
[ -z "$(git -C engine/forge status --porcelain --untracked-files=all)" ] || { echo "engine/forge is not clean" >&2; exit 1; }
prefix="openmana-source-${commit}/"
work="$(mktemp -d "${TMPDIR:-/tmp}/openmana-source.XXXXXX")"
trap 'rm -rf "$work"' EXIT
git archive --format=tar --prefix="$prefix" -o "$work/main.tar" HEAD
git -C engine/forge archive --format=tar --prefix="${prefix}engine/forge/" -o "$work/forge.tar" "$pin"
tar --concatenate --file="$work/main.tar" "$work/forge.tar"
mkdir -p "$out"
name="openmana-source-${commit}.tar.gz"
gzip -9 -n -c "$work/main.tar" > "$out/$name"
(cd "$out" && sha256sum "$name" > "$name.sha256")
echo "[openmana] $out/$name (OpenMana ${commit:0:10} + Forge ${pin:0:10})"

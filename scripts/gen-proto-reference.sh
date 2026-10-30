#!/usr/bin/env bash
# Generates src/generated/proto-reference.json from the .proto files of the Vigie repository with the pseudomuto-doc buf
# remote plugin. src/pages/reference/proto.astro renders the file in the doc layout.
#
# Needs git and buf. VIGIE_REPO and VIGIE_REF pick another clone URL or branch. VIGIE_DIR uses an existing checkout
# instead of cloning, to see proto comments that aren't pushed yet.
set -euo pipefail

repo=${VIGIE_REPO:-https://github.com/seagalia/vigie.git}
ref=${VIGIE_REF:-main}
doc_root=$(cd "$(dirname "$0")/.." && pwd)
target="$doc_root/src/generated/proto-reference.json"

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

vigie_dir=${VIGIE_DIR:-}
if [ -z "$vigie_dir" ]; then
	git clone --quiet --depth 1 --branch "$ref" "$repo" "$work/vigie"
	vigie_dir="$work/vigie"
fi

# JSON output, because the comments are Markdown that the doc site renders itself.
cat > "$work/buf.gen.yaml" <<'YAML'
version: v2
plugins:
  - remote: buf.build/community/pseudomuto-doc:v1.5.1
    out: out
    opt:
      - json,proto.json
YAML

(cd "$vigie_dir/api" && buf generate --template "$work/buf.gen.yaml" -o "$work")

mkdir -p "$(dirname "$target")"
cp "$work/out/proto.json" "$target"
echo "wrote $target"

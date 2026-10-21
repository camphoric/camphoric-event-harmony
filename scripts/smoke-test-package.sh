#!/bin/sh
# Smoke-test the package as it's published: pack it (which builds it),
# install the tarball into a fresh project (with the spec, its peer, from
# npm: the newest in its range, or the exact version $SPEC_VERSION names),
# and load it from its build with plain Node (no tsx, no TypeScript source),
# checking what the Camphoric importer relies on.
#
#   SPEC_VERSION=1.0.0 scripts/smoke-test-package.sh
set -eu
SPEC=@camphoric/camphoric-event-import-spec

cd "$(dirname "$0")/.."
ROOT=$(pwd)
NAME=$(node -p "require('./package.json').name")
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

npm pack --silent --pack-destination "$TMP" > /dev/null
cd "$TMP"
TARBALL=$(ls ./*.tgz)

# The tarball holds the build and the report templates (when the event has
# any), not the bulk script, the tests or the configs.
tar -tzf "$TARBALL" > files.txt
grep -q '^package/dist/index\.js$' files.txt
grep -q '^package/dist/index\.d\.ts$' files.txt
if [ -d "$ROOT/reports" ]; then grep -q '^package/reports/' files.txt; fi
UNWANTED='__tests__|e2e/|scripts/|addRegistrations|jest\.config|playwright\.config|tsconfig|eslint\.config|\.github'
if grep -qE "$UNWANTED" files.txt; then
  echo "$TARBALL holds files it shouldn't:" >&2
  grep -E "$UNWANTED" files.txt >&2
  exit 1
fi

npm init -y > /dev/null
npm pkg set type=module
if [ -n "${SPEC_VERSION:-}" ]; then
  # One outside the peer range (a new major, a pre-release) makes npm refuse;
  # then install it over the range
  npm install --silent --no-audit --no-fund "$TARBALL" "$SPEC@$SPEC_VERSION" || {
    echo "npm refused $SPEC@$SPEC_VERSION; installing again with --force, over the peer range" >&2
    npm install --no-audit --no-fund --force "$TARBALL" "$SPEC@$SPEC_VERSION"
  }
  INSTALLED=$(node -p "require('./node_modules/$SPEC/package.json').version")
  WANT=${SPEC_VERSION#=}
  WANT=${WANT#v}   # npm takes =1.0.0 and v1.0.0 as 1.0.0
  if [ "$INSTALLED" != "$WANT" ]; then
    echo "$SPEC $INSTALLED is installed, not $SPEC_VERSION (give an exact version)" >&2
    exit 1
  fi
else
  npm install --silent --no-audit --no-fund "$TARBALL"
fi

# The spec is the project's own copy, as the package's peer
node -e "assert.ok(require('$NAME/package.json').peerDependencies['$SPEC'])"
test -d "node_modules/$SPEC"
test ! -e "node_modules/$NAME/node_modules/$SPEC"
if grep -q camphoric-source "node_modules/$NAME/package.json"; then
  echo "the published package.json names the in-repo camphoric-source export" >&2
  exit 1
fi

NAME="$NAME" node --input-type=module -e "
import assert from 'node:assert/strict';
import { validateEventImport } from '@camphoric/camphoric-event-import-spec';

const event = (await import(process.env.NAME)).default;
assert.match(import.meta.resolve(process.env.NAME), /\/dist\/index\.js$/);
assert.deepEqual(validateEventImport(event.data), []);
assert.equal(event.organization.organization.name, event.data.organization);
for (const report of event.data.reports) assert.ok(report.template.trim(), report.title + ' has no template');

// Its overrides and sample registrations run from the build too
const lodging = new Proxy({}, { get: (_, key) => ({ id: 1, name: String(key) }) });
const results = { event: { id: 1 }, lodging };
const calls = [];
for (const override of event.overrides ?? []) {
  await override(async (...args) => { calls.push(args); return {}; }, results, () => {});
}
const regs = event.sampleRegGenerator ? await event.sampleRegGenerator(async () => ({}), results, () => {}) : [];
console.log(process.env.NAME + ' loads from its build: ' + event.data.reports.length + ' reports, '
  + calls.length + ' override calls, ' + regs.length + ' sample registrations');
"

# @camphoric/camphoric-event-harmony

The San Francisco Folk Music Club's **Camp Harmony**, as a [Camphoric](https://github.com/camphoric/camphoric)
event: its import object (the registration form, pricing, lodging, emails and reports), its
organization, its sample registrations, and a script that adds generated registrations to an
imported event.

It satisfies the contract in
[`@camphoric/camphoric-event-import-spec`](https://github.com/camphoric/camphoric/tree/main/data/packages/event-import-spec),
and Camphoric's importer (`data/` in the Camphoric repository) installs it from npm and
imports it.

## Developing

```bash
npm ci                          # install
npm test                        # unit tests, including the spec's conformance checks
npm run typecheck
npm run lint                    # type-check, then ESLint
npm run build                   # compile index.ts to dist/ (what's published)
scripts/smoke-test-package.sh   # pack it, install it, and load it from its build with plain Node
```

The event's source is TypeScript; the published package is its build (`dist/`) and its report
templates (`reports/`). The spec is a **peer dependency** (`^1.0.0`), so Camphoric's importer loads
one copy of it for every event; a spec major this event doesn't follow fails to install rather than
nesting a second copy. Camphoric's `RELEASE.md` ("What a spec version means") describes how a new
spec major is rolled out.

To add generated registrations to an event imported into a running Camphoric:

```bash
CAMPHORIC_URL=http://localhost:8000 DJANGO_SUPERUSER_USERNAME=admin DJANGO_SUPERUSER_PASSWORD=admin COUNT=10 npm run bulk
```

(`addRegistrations.ts` describes its other settings. Each completed registration queues a
confirmation email, so run it where mail goes to the console, as in local development.)

## End-to-end tests

`e2e/` holds Playwright tests of the registration form, using the harness in
`@camphoric/camphoric-event-import-tools/e2e`. Before they run, a throwaway Camphoric starts
(the release image and Postgres, in Docker, on a free port), this event is imported into it with
its registration window open, and afterwards the server is removed.

```bash
npx playwright install chromium   # once
npm run e2e                       # needs Docker
```

Locally the results are listed in the terminal; `npm run e2e -- --reporter=html`, then `npx
playwright show-report`, gives the HTML report (with traces) that CI uploads.

- `CAMPHORIC_IMAGE_TAG` picks the release image's tag (default `latest`, pulled fresh);
  `CAMPHORIC_E2E_IMAGE` names a locally built image instead.
- `CAMPHORIC_E2E_SERVER_URL`, with `CAMPHORIC_E2E_SERVER_USERNAME` / `_PASSWORD`, imports into
  a running server instead of starting one.
- Every test, on desktop and mobile Chrome, shares the one imported event, so a registration one
  test completes stays.
- The rates are early or regular depending on the day, so the price tests compare totals (one
  night against two, with and without linens, …) rather than expect fixed amounts.
- The `registration` fixture is a page object for the form (fields by label, campers, lodging, the
  price ticker, submitting and paying). The client's markup lives only there, so a change to the
  Camphoric client changes the harness, not these tests.

`.github/workflows/e2e.yml` runs them on pull requests, from `upstream.yml` (below), and on
demand.

## Testing against new Camphoric releases

`.github/workflows/upstream.yml` ("Camphoric releases") tests this event against the newest
Camphoric release and import packages, rather than the lockfile's. Every 6 hours it finds the
newest stable Camphoric release (by version) whose image `ghcr.io/camphoric/camphoric:vX.Y.Z` is
published, and the newest `@camphoric/camphoric-event-import-spec` and `-tools` versions within
this event's ranges in `package.json`. A release is created before its image is pushed, so until
the newest release's image is published it tests the newest release before it that has one, and
says so in the run's summary and notes. Once the release is a day old, the note says instead that
its image was never published and that the release's `build-image` job needs re-running. It looks
each image up in GHCR's registry API, with retries: an answer other than found or not found (an
outage, say) fails the run, rather than counting as a missing image. When it hasn't tested that
combination yet, it runs `ci.yml` and `e2e.yml` against exactly those versions; the run's summary
lists them.

A combination is tested once, pass or fail: a marker in the Actions cache records it, keyed by
the Camphoric release and package versions tested and by each package's newest version, in this
event's range or not. So the first check after a newer release's image is published tests it, and
a new major outside a range is tested, and reported, within 6 hours. When none of the five newest
releases has a published image, the 6-hourly check waits.

On Mondays at 14:00 UTC it tests regardless. That catches drift no release causes, such as a new
Node 22 or runner image, or a new in-range version of a dependency that the smoke test installs
from npm. Chromium comes with `@playwright/test`: the lockfile's, unless the import-tools version
tested needs a newer one, when npm installs the newest its peer range allows, so a new Playwright
release changes it too. The CI and E2E summaries list this event's top-level packages as
installed, and name each whose version isn't the one `package-lock.json` pins: the requested
packages, and any they moved, such as `@playwright/test`. With no image found, it tests the newest
release anyway, so the missing image is reported, and it doesn't record the combination.

A failure opens a **`camphoric-compat`** issue here, or comments on the open one, naming the
versions tested; so does a note that a package has a version newer than this event's range
allows (a new major, which this event needs migrating to), or that the newest release's image
isn't published. A report the issue already has isn't repeated, and a clean run closes it. A
note's wording is fixed (a missing image's changes once, when its release is a day old), so the
same note isn't reported again on each run.

A fix pushed here runs CI against the lockfile, not the new versions, and the marker keeps the
6-hourly check from retrying the failed combination. To test it again (and close the issue)
before Monday, run it with `force`:

```bash
gh workflow run upstream.yml -f force=true
```

To run CI or E2E by hand against a given image tag (a pre-release, say) or exact package
versions:

```bash
gh workflow run e2e.yml -f image_tag=v0.15.0-rc.1
gh workflow run e2e.yml -f spec_version=1.0.1 -f tools_version=1.2.1
gh workflow run ci.yml -f spec_version=1.0.1 -f tools_version=1.2.1
```

A version outside this event's range works too, such as a new major or a pre-release
(`-f tools_version=1.3.0-rc.1`): the run installs it over the range (with `--force` if a peer
range makes npm refuse it), checks the installed package's own version, and marks it `invalid` in
the summary's `npm ls`. It must be an exact version, not a range or a tag. CI's smoke test
installs the packed package with the `spec_version` given (`tools_version` doesn't apply, since
the package doesn't depend on the tools). To do the same locally:

```bash
SPEC_VERSION=1.0.0 scripts/smoke-test-package.sh
```

GitHub disables scheduled workflows in a public repository after 60 days without activity; if
the Actions tab shows "Camphoric releases" disabled, enable it there.

## Releases

Commits follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat:` and `fix:`
release; `feat!:` is a major). On each push to `main`,
[release-please](https://github.com/googleapis/release-please) keeps a release PR up to date
with the version bump and `CHANGELOG.md`. Merging it tags `vX.Y.Z`, creates the GitHub Release,
and publishes the package to npm. To publish a released tag again, if that failed:

```bash
gh workflow run release-please.yml -f tag=v1.0.0
```

The package's settings on npmjs.com list this repository and `release-please.yml` as its GitHub
Actions trusted publisher, allowed to `npm publish`. npm drops a trusted publisher that hasn't
published within 2 days of being added; without a matching one, the publish fails with npm's 404
or `ENEEDAUTH`.

## History

This event was developed in the Camphoric repository, under `data/`, until it moved here with its
history. Issue and pull request
numbers in commit messages before the move refer to
[camphoric/camphoric](https://github.com/camphoric/camphoric).

## License

MIT

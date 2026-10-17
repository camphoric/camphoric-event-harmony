# @camphoric/camphoric-event-harmony

The San Francisco Folk Music Club's **Camp Harmony**, as a [Camphoric](https://github.com/camphoric/camphoric)
event: its import object (the registration form, pricing, lodging, emails and reports), its
organization, its sample registrations, and a script that adds generated registrations to an
imported event.

It satisfies the contract in
[`@camphoric/camphoric-event-import-spec`](https://github.com/camphoric/camphoric/tree/main/data/packages/event-import-spec),
and Camphoric's importer (`data/` in the Camphoric repository) installs it from GitHub Packages
and imports it.

## Installing from GitHub Packages

The `@camphoric` packages are on GitHub Packages, which needs a token to install **even public
packages**. This repository's `.npmrc` points the `@camphoric` scope there; give npm a token with
the `read:packages` scope, never in a committed file:

```bash
gh auth refresh -s read:packages
```

```bash
npm config set //npm.pkg.github.com/:_authToken "$(gh auth token)"
```

In GitHub Actions, the workflows use the job's own `GITHUB_TOKEN` (with `packages: read`).

## Developing

```bash
npm ci                          # install (needs the token above)
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

`.github/workflows/e2e.yml` runs them on pull requests, weekly (so a Camphoric release that
changes the form shows up here), and on demand, where it can pick an image tag.

## Releases

Commits follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat:` and `fix:`
release; `feat!:` is a major). On each push to `main`,
[release-please](https://github.com/googleapis/release-please) keeps a release PR up to date
with the version bump and `CHANGELOG.md`. Merging it tags `vX.Y.Z`, creates the GitHub Release,
and publishes the package to GitHub Packages. To publish a released tag again, if that failed:

```bash
gh workflow run release-please.yml -f tag=v1.0.0
```

The repository publishes the package, so in the package's settings, under "Manage Actions
access", this repository must keep the **Write** (or Admin) role.

## History

This event was developed in the Camphoric repository, under `data/`, until it moved here with its
history. Issue and pull request
numbers in commit messages before the move refer to
[camphoric/camphoric](https://github.com/camphoric/camphoric).

## License

MIT

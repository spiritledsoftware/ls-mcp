# Changesets

This repo uses Changesets to manage package versions, changelog entries, and npm publishing.

For user-facing changes, run `pnpm changeset`, choose the appropriate semver bump, and commit the generated changeset file with the code change.

Merging the Changesets version PR publishes the package to npm through GitHub Actions trusted publishing. Configure npm trust for `.github/workflows/release.yml`; no `NPM_TOKEN` repository secret is required.

---
title: Mason Backed LSP Registry Review Outcome
summary: Installer review requested GitHub cache reuse and resolver-level tests; npm path, pinned GitHub versions, downloads-disabled handling, and mocked tests were correct.
tags: []
related: [facts/project/current_runtime_timestamp.md]
keywords: []
createdAt: '2026-05-25T20:21:40.673Z'
updatedAt: '2026-05-25T20:21:40.673Z'
---
## Reason
Capture the durable review outcome and verification details from the installer spec compliance review.

## Raw Concept
**Task:**
Document the installer spec compliance review outcome for Task 4 of docs/plans/2026-05-25-mason-backed-lsp-registry.md.

**Changes:**
- Recorded the CHANGES_REQUESTED review outcome
- Captured the GitHub cache reuse gap and the recommended fix
- Captured the missing resolver-level GitHub test coverage
- Preserved the verified correct behaviors for npm, pinned versions, downloads-disabled handling, and mocked tests

**Files:**
- src/registry/installer.ts
- src/registry/githubInstaller.ts
- src/registry/builtins.ts
- tests/unit/installer.test.ts
- docs/plans/2026-05-25-mason-backed-lsp-registry.md

**Flow:**
review request -> spec comparison -> findings recorded -> verification summary captured

**Timestamp:** 2026-05-25T20:21:25.036Z

**Author:** assistant review

**Patterns:**
- `resolveLspServerCommand()` - Resolver-level command resolution referenced in missing GitHub test coverage.
- `installStrategy.binPath` - Recommended cached-command resolution for GitHub-backed installers.

## Narrative
### Structure
The review outcome distinguishes requested changes from verified correct behavior across installer, GitHub installer, and unit tests.

### Dependencies
The GitHub caching fix depends on resolver-level reuse of installStrategy.binPath and test coverage that exercises resolveLspServerCommand.

### Highlights
The review confirmed npm behavior, pinned GitHub version usage, downloads-disabled behavior, and mocked network/filesystem tests while flagging missing GitHub cache reuse.

### Rules
Return APPROVED or CHANGES_REQUESTED with file/line findings.

### Examples
Example recommendation: add GitHub cached-command resolution using installStrategy.binPath and check it before install and inside the lock.

## Facts
- **review_status**: The installer review returned CHANGES_REQUESTED for Task 4 of the mason-backed LSP registry plan. [project]
- **github_cache_reuse**: GitHub-backed selected built-ins were not treated as cached in the installer resolver, so repeated resolver calls would reinstall and redownload. [project]
- **github_cached_command_resolution**: The recommended fix was to add GitHub cached-command resolution using installStrategy.binPath and check it before install and inside the lock. [project]
- **github_resolver_test_coverage**: Resolver-level tests for GitHub strategy coverage were missing; the existing test only called installGitHubServer directly. [project]
- **npm_install_path**: The npm install path was preserved. [project]
- **github_version_lookup**: Pinned metadata.version was used in githubInstaller and there were no runtime latest lookups. [project]
- **downloads_disabled_behavior**: System-only and downloads-disabled paths were evaluated before installation so they did not call installers. [project]
- **network_mocking**: The reviewed GitHub unit test mocked fetch and extraction and did not perform real network access. [project]
- **installer_test_results**: Running pnpm test tests/unit/installer.test.ts passed with 25 tests. [project]

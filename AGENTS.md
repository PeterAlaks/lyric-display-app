# Agent Instructions

These instructions apply to the entire LyricDisplay repository.

## Development Servers

- Never start a development server unless the user explicitly asks you to do so.
- This includes `npm run dev`, `npm run preview`, `npm run server`, `npm run electron-dev`, and any equivalent long-running process.
- Do not start a server implicitly for verification. Use static checks, builds, and non-interactive tests when they are sufficient.

## Testing and Development Workflow

Prefer test-driven development for behavioral changes, bug fixes, and new application logic when the behavior is practical and valuable to test.

When practical:

1. Define the expected behavior before changing the implementation.
2. Add or update a focused test that expresses that behavior.
3. Run the test and confirm it fails for the expected reason.
4. Implement the smallest correct change required to make it pass.
5. Run the focused test, then the relevant surrounding test suite, and verify that existing behavior has not regressed.
6. Refactor only after the behavior is passing.

Prefer extending an existing relevant test file. Do not create a new test file unless it is explicitly necessary, provides durable and meaningful project-level coverage, and no existing test file is an appropriate home for the case.

Do not create low-value, artificial, redundant, or implementation-detail tests merely to satisfy this workflow. Pure visual changes, documentation, configuration, trivial copy changes, and code that is impractical to test may be implemented directly. Run existing relevant tests where applicable.

## Bug Fixes

For a reproducible bug involving application logic, do not modify the implementation immediately. First:

1. Identify and explain the root cause.
2. Add a focused regression case to an existing appropriate test file whenever possible.
3. Run it and verify that it fails because of the reported bug.
4. Implement the fix.
5. Verify that the regression test now passes.
6. Run the relevant surrounding tests.

A regression test should make the bug difficult to reintroduce silently. If a regression test would be impractical, brittle, or low-value, document why and use the strongest relevant existing verification instead.

## Test Commands

- Use `npm run test:unit` for the full unit suite.
- For focused verification, use Node's test runner against the relevant existing file, for example `node --test tests/<name>.test.js`.
- Run additional checks such as `npm run check:static`, `npm run check:contracts`, or `npm run build` when they are relevant to the changed area.

## Release Notes Workflow

Use this workflow when the user asks to draft or generate release notes for a new LyricDisplay version.

1. Refresh the remote branch and tags before calculating the release range. Unless the user provides a different baseline, use the latest published GitHub release whose tagged commit is the most recent `chore: release v<version>` commit.
2. Inspect several recent published GitHub release bodies, with extra weight on the latest releases, to learn the current structure, tone, category names, download section, installation text, and platform notes. Do not rely on a generic changelog template when the repository's established style is available.
3. Compare the baseline tag with the requested target, normally `origin/master`. Examine the actual diffs, relevant implementation, and tests in addition to commit subjects so the notes describe verified user-visible behavior accurately.
4. Include only noteworthy additions, major workflow or UX improvements, and important bug, stability, security, packaging, or developer changes. Consolidate related commits into outcome-focused bullets. Omit dependency-only updates, refactors, formatting, copy, icon, minor styling, and other routine maintenance unless they have a meaningful release-level impact.
5. Match the most recent applicable release-note style and terminology. Preserve recurring download and platform boilerplate, update every version and artifact name to the requested version, and avoid inventing unsupported claims or sections.
6. Return copy-ready Markdown and briefly state the baseline and comparison range used. Do not change the package version, create a tag or release, publish anything, or edit repository files unless the user separately requests those actions.

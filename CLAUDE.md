# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

N Air is an Electron-based desktop streaming application for niconico live streaming, forked from Streamlabs OBS. It combines Vue.js frontend with native OBS streaming capabilities, specifically tailored for Japanese live streaming needs.

**Tech Stack:** Electron 29.3.1, Vue.js 3.5.34, TypeScript 5.5.4, OBS Studio Node, Webpack 5

## Development Commands

**Setup:**
```bash
# Install dependencies (requires GitHub Personal Access Token for @n-air-app packages)
npm login --scope=@n-air-app --registry=https://npm.pkg.github.com
pnpm install
pnpm install --dir bin  # Required for pnpm start
```

**Worktrees:** Each git worktree is an independent directory and does not share `node_modules` with the main working tree. Always run `pnpm install` (and `pnpm install --dir bin`) immediately after creating a worktree before building or running the app. When using Claude Code, call `EnterWorktree({ path })` to switch the session's cwd into the worktree (avoids needing `Set-Location` on every subsequent command).

**Development:**
```bash
pnpm run compile    # Build development assets
pnpm start          # Run application
pnpm dev            # Development mode with hot reload (webpack dev server + electron)
pnpm run watch      # Watch mode compilation
```

**Build & Package:**
```bash
pnpm run compile:production     # Production build
pnpm run package                # Package for distribution (stable)
pnpm run package:public-unstable  # Package unstable build
```

**Testing:**
```bash
pnpm test           # Full test suite (i18n check + TypeScript compile + AVA)
pnpm run test:unit  # Unit tests (Jest for app + bin)
pnpm run test:unit:app  # Jest tests for app only
pnpm screentest     # Visual regression tests
```

> **Note:** `pnpm test` runs the full suite (i18n + tsc + AVA) and is slow. For day-to-day development, prefer `pnpm run test:unit:app`. For TypeScript type checking (including `.vue` files), run `pnpm run typecheck` separately.

**Code Quality:**
```bash
pnpm lint           # ESLint + Stylelint
pnpm format         # ESLint fix + Stylelint fix + sort-package-json
```

## Architecture

**Service Layer:** Singleton services with RxJS reactive state management, dependency injection pattern. Services located in `app/services/`

**Service Registration:** All services must be registered in `app/app-services.ts`. Forgetting to add a new service here causes a runtime error (`Service not found: XxxService`) when the service is first accessed via `@Inject`, which can cause unexpected crash loops (e.g., OBS output signal callbacks retrying on exception).

**Vue Components:** 
- `app/components/nicolive-area/` - Niconico-specific UI
- `app/components/obs/` - OBS integration components  
- `app/components/shared/` - Reusable components
- `app/components/windows/` - Window management

**OBS Integration:** Native OBS Studio Node bindings for video streaming, source management, scene collections, and filters

**Multi-Window Architecture:** Main window + child windows with IPC communication via Electron Remote

**Niconico Features:** Live comment system, program management, user auth, voice synthesis (N Voice, VOICEVOX), custom cast support

## Key Development Patterns

**Import Paths:** Uses TypeScript path mapping with `baseUrl: "./app"` - import from app root without relative paths

**Decorators:** Vue components use `defineComponent` (Options API) — no class-based decorators. Service layer uses custom decorators (`@Inject`, `@mutation`, `@ServiceHelper`, `@shortcut`, `@InitAfter`) via experimentalDecorators. See [docs/decorators.md](docs/decorators.md).

**State Management:** RxJS Subjects/BehaviorSubjects in services. `StatefulService<T>` uses Vuex 4 for cross-process state sync; plain `Service` does not.

**Window Communication:** Use `@electron/remote` for IPC between main and renderer processes

## Testing Setup

**Unit Tests:** Jest with `@kayahr/jest-electron-runner` for Electron environment
**E2E Tests:** Custom WebDriver wrapper with Electron ChromeDriver
**Test Location:** Tests in `test/` directory, compiled to `test-dist/`

## Build System

**Webpack Config:** Multiple entry points (renderer, updater), TypeScript + Vue SFC support
**Asset Handling:** Fonts, images, media files processed through webpack loaders
**Development:** Hot reload via webpack-dev-server on port 8080

## Internationalization

**Location:** `app/i18n/` with Japanese/English support
**Validation:** Pre-commit hook runs i18n integrity checks
**Framework:** Vue-i18n 9.x (legacy mode)

## Unit Testing Guidelines

**Test File Location:** Place test files next to their target modules with `*.test.ts` naming (e.g., `file-manager.test.ts` for `file-manager.ts`)

**Service Testing Architecture:**
- Services are **singletons** with **RPC-based cross-process synchronization** using dependency injection
- Use `createSetupFunction()` to mock service dependencies and state
- Must mock `services/core/stateful-service` and `services/core/injector` before importing services
- Access service instances via `require('./service-name').ServiceName.instance` after setup

**Fake Timers:** Always use `@sinonjs/fake-timers` for time-related testing, not Jest's built-in timers

**Common Test Patterns:**
```typescript
// Service test setup
import { createSetupFunction } from 'util/test-setup';

const setup = createSetupFunction({
  state: { ServiceName: { someState: 'value' } },
  injectee: { DependencyService: mockDependency }
});

beforeEach(() => {
  jest.mock('services/core/stateful-service');
  jest.mock('services/core/injector');
  jest.resetModules();
});

test('service behavior', () => {
  setup();
  const { ServiceName } = require('./service-name');
  const instance = ServiceName.instance;
  // test implementation
});
```

**RxJS & State Management:** Services use RxJS Subjects/BehaviorSubjects for reactive state, test these observables appropriately

## Code Style

**Formatting:** ESLint (airbnb-base + overrides) が single quotes / trailing commas / 2-space indent を強制。CSS/Less は Stylelint
**Linting:** ESLint with TypeScript + Vue plugins, Stylelint for CSS/Less
**Pre-commit:** Husky + lint-staged runs formatting and linting automatically

## Git & GitHub Workflow

**Repository:** Always push to and create PRs against `github.com/n-air-app/n-air-app` (NOT the original Streamlabs fork)
**Target Branch:** Create PRs against `n-air-development` branch (the main development branch)
**Commits:** Standard commit message format, include context about changes

**Push Remote Configuration:** Developers may use different remotes (personal forks vs main repo):
- Configure via `.claude/settings.local.json` env variables:
  - `NAIR_GIT_PUSH_REMOTE`: remote name (e.g., "origin", or a personal fork remote)
  - `NAIR_GIT_TARGET_REPO`: target repository (e.g., "n-air-app/n-air-app", or a personal fork)
- Use `git push -u ${NAIR_GIT_PUSH_REMOTE:-origin} branch-name` for pushes
- Use `gh pr create --repo ${NAIR_GIT_TARGET_REPO:-n-air-app/n-air-app}` for PRs

**PR Title Rules:** PR titles are collected for patch notes shown to users:
- **User-visible changes:** Use prefixes that will be grouped in patch notes. The title is shown **as-is to end users** in the patch notes, so write it from the user's perspective — what they can now do, what changed, or what was fixed — not as a technical description:
  - `追加:` - New features users can see/use
  - `変更:` - Changes to existing user-visible functionality  
  - `修正:` - Bug fixes users would notice
- **Internal/development changes:** Use `開発:` prefix (not shown to users) for technical/internal changes
- Write titles in Japanese using verb form (not noun form): `○○機能を追加`, `○○問題を修正`
- Examples: `追加: ニコニコ生放送のコメント読み上げ機能を追加`, `修正: 配信開始時のクラッシュ問題を修正`, `開発: ユニットテストを追加`

**PR Body Rules:**
- **Issue references:** Use `Closes #NNN` / `Fixes #NNN` / `Resolves #NNN` only when the PR fully resolves the issue — GitHub automatically closes it on merge. For ongoing tracking issues (e.g., security alert trackers), use `関連: #NNN` instead.
- **Dependabot alert numbers:** Write as `Alert NNN` (not `#NNN`, which becomes a PR/issue link). In tables, use the full URL: `[Alert NNN](https://github.com/n-air-app/n-air-app/security/dependabot/NNN)`. Always add the `dependencies` label (`--label "dependencies"`) on dependency update PRs. For multiple CVEs, write each in full (e.g., `CVE-2026-41672/CVE-2026-41674`), not abbreviated (`CVE-2026-41672/41674`).
- **Test plan:** List only items requiring manual verification by a human. Do not list CI checks (`pnpm test`, tsc, CI pass) — branch protection enforces these automatically. Omit the Test plan section entirely for lockfile-only PRs.
- **`gh` body with markdown:** Always pass PR/issue body via `--body-file` (write to a temp file first). Backticks and other shell special characters in `--body "..."` are expanded by the shell.

## Dependencies Notes

**Native Modules:** Several native dependencies hosted on GitHub releases (obs-studio-node, font-manager, etc.)
**Package Manager:** Must use pnpm (managed via Corepack), lockfiles committed (pnpm-lock.yaml at root and bin/)
**Node Version:** Requires Node.js 22.x LTS
**Important:** `.npmrc` is configured with `node-linker=hoisted` to maintain flat node_modules structure for native modules that use relative path references in electron-builder packaging

**bin/ lockfile update:** `bin/` is an independent pnpm project (not part of the root workspace). The root `.npmrc` and `pnpm-workspace.yaml` interfere with `cd bin && pnpm install`, causing it to run in the root workspace context instead. To correctly update `bin/pnpm-lock.yaml`, use the `--ignore-workspace` flag from within the `bin/` directory:
```bash
cd bin && PNPM_HOME="" pnpm install --ignore-workspace
# or for updating specific packages:
cd bin && PNPM_HOME="" pnpm update <package-name> --ignore-workspace
```
Also ensure `bin/package.json`'s `packageManager` field matches the root `package.json` to use the same pnpm version.

## Decorators

**Current Status:** See [docs/decorators.md](docs/decorators.md) for decorator usage inventory (Vue 3 migration complete)
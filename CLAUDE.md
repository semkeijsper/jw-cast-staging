# CLAUDE.md

This file provides guidance for AI assistants working in this repository.

## Project Overview

**jw-cast** is a Vue 2 + TypeScript single-page application that provides a frontend interface for browsing and playing Jehovah's Witnesses media from jw.org. Users can independently select the audio language and subtitle language for videos, and watch via the embedded player, Chromecast (SMPlayer), or VLC.

- **Live site:** https://jwcast.semdev.nl
- **Deployment:** GitHub Pages via `git subtree push --prefix dist origin gh-pages`
- **No backend:** pure client-side app consuming jw.org's public API directly

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Vue 2.6 |
| Language | TypeScript 4.5 (strict mode) |
| UI Library | Vuetify 2.6 (Material Design) |
| State | Vuex 3 with vuex-class decorators |
| Routing | Vue Router 3 |
| Video player | Plyr |
| Carousel | Swiper via vue-awesome-swiper |
| HTTP client | Axios 0.24 |
| Package manager | Yarn 3.4.1 (node-modules linker, not PnP) |
| Linting | ESLint (Airbnb + Vue + TypeScript) + Prettier |

## Development Commands

```bash
yarn serve    # Start dev server with hot reload
yarn build    # Production build into /dist
yarn lint     # Run ESLint
```

**There are no automated tests.** There is no test runner, no test files, and no test script.

## Repository Structure

```
src/
├── components/
│   ├── VideoCategory.vue      # Renders a named category with its video list
│   ├── VideoDialog.vue        # Full-screen video player modal (Plyr)
│   ├── VideoSwiper.vue        # Horizontal scrolling carousel for a category
│   ├── VideoGrid.vue          # Grid layout for search results
│   ├── SearchDialog.vue       # Search UI backed by jw.org search API
│   ├── TranscriptDialog.vue   # Displays video transcript
│   └── button/
│       ├── CastButton.vue     # Opens SMPlayer with stream URL for Chromecast
│       ├── SubtitleButton.vue # Subtitle language selector
│       └── VideoButton.vue    # Generic video action button
├── plugins/
│   ├── vuetify.ts             # Vuetify setup + dark mode detection
│   ├── video-player.ts        # Plyr player initialization
│   └── swiper.ts              # Swiper initialization
├── router/
│   └── index.ts               # Single route: /:language, default redirect to browser language or 'nl'
├── store/
│   └── index.ts               # All Vuex state, getters, mutations
├── types/
│   ├── index.ts               # Domain interfaces: Language, Video, Category, SearchResponse, etc.
│   └── store.ts               # StoreState interface
├── App.vue                    # Root component: header, language selector, category list
├── main.ts                    # Vue bootstrap: app, router, store, Vuetify
└── shims-*.d.ts               # TypeScript module declarations
public/
├── index.html                 # HTML entry: GA tag, PWA manifest, font/icon CDN links
└── assets/                    # Favicons, PWA manifest
dist/                          # Build output (not committed to master)
```

## Code Conventions

### Component Style

All components use **Vue Class Components** with TypeScript decorators — not the Options API or Composition API.

```typescript
import { Component, Prop, Watch, Vue } from 'vue-property-decorator';
import { State, Getter, Mutation } from 'vuex-class';

@Component({ components: { SubComponent } })
export default class MyComponent extends Vue {
  @Prop() myProp!: string;

  @State selectedVideo!: Video | null;
  @Mutation setVideoDialog!: (value: boolean) => void;

  @Watch('myProp')
  onMyPropChange(val: string) { ... }

  get computedValue(): string { ... }

  onClickSomething(): void { ... }
}
```

### Naming Conventions

- **Components:** PascalCase filenames and class names (`VideoDialog.vue`)
- **Methods:** camelCase; event handlers prefixed with `on` (`onClickVideo`, `onRouteLanguageChange`)
- **Vuex mutations:** `set` prefix (`setSiteLanguage`, `setVideoDialog`)
- **Booleans for dialogs:** named `dialog` in components, `videoDialog` / `searchDialog` in store
- **CSS classes:** kebab-case; Vuetify utility classes used throughout

### Styling

- Scoped SCSS inside `.vue` files
- Vuetify Material Design grid/layout classes (`v-container`, `v-row`, `v-col`)
- Responsive breakpoints via `$vuetify.breakpoint.smAndDown` / `mdAndUp`
- Dark mode: detected at startup via `window.matchMedia('(prefers-color-scheme:dark)')`

### Formatting

Enforced by Prettier (`.prettierrc`) and ESLint:

- Single quotes
- Semicolons
- Trailing commas everywhere
- Print width: 100 characters
- Indent: 2 spaces (enforced by `.editorconfig`)

Run `yarn lint` to check; fix issues before committing.

### TypeScript

- Strict mode is on — no implicit `any`, no non-null assertion shortcuts without justification
- Domain types live in `src/types/index.ts`; add new interfaces there
- Store state type is in `src/types/store.ts`
- Path alias `@/` resolves to `src/`

## State Management

The Vuex store (`src/store/index.ts`) is flat — no modules. It holds:

| State field | Purpose |
|---|---|
| `mediatorUrl` | Base URL for jw.org media API |
| `searchUrl` | Base URL for jw.org search API |
| `tokenUrl` | URL for stream tokens |
| `languages` | Available languages (seed: Dutch + English; expanded from API) |
| `siteLanguage` | Selected UI language code |
| `videoLanguage` | Selected audio language for videos |
| `subtitleLanguage` | Selected subtitle language |
| `translations` | Fetched translation strings keyed by language |
| `searchDialog` | Whether search dialog is open |
| `videoDialog` | Whether video player dialog is open |
| `transcriptDialog` | Whether transcript dialog is open |
| `selectedVideo` | Currently focused `Video` object |
| `selectedSubtitle` | Currently focused subtitle media reference |

All mutations follow the `set*` naming pattern. There are no Vuex actions — async API calls are made directly in component lifecycle hooks (`mounted`, `created`) or watchers.

## Routing

Single route: `/:language` (named `"Home"`).

The `language` param drives which media language is loaded. On app load, the router redirects to the user's browser language (`navigator.language`) or falls back to `'nl'` (Dutch).

## API Integration

The app consumes public jw.org endpoints stored as constants in the Vuex store. All HTTP calls use axios directly inside components — there is no API service layer abstraction. Calls follow async/await pattern.

## Deployment

```bash
yarn build
git subtree push --prefix dist origin gh-pages
```

The `dist/` directory is built locally and pushed to the `gh-pages` branch. There is no CI/CD pipeline.

## Git Workflow

- Default branch: `master`
- Feature work: use descriptive branches off `master`
- Commit style: use lowercase imperative messages with optional `(scope):` prefix (e.g. `fix(App): scroll within main content`)
- No pre-commit hooks are configured

## Things to Avoid

- **Do not introduce the Composition API or Options API** — the codebase uses Class Components consistently.
- **Do not add a test framework** unless explicitly requested; there is no existing test infrastructure to align with.
- **Do not abstract API calls** into a service layer unless the task specifically calls for it — direct axios calls in components is the established pattern.
- **Do not add Vuex actions** unless async complexity warrants it — the current pattern is direct mutations.
- **Do not upgrade to Vue 3** — the app is intentionally on Vue 2 with its Vuetify 2 ecosystem.
- **Do not add comments** to code that is already self-explanatory; only comment non-obvious logic.

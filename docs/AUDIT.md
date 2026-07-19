# Codebase Audit — jw-cast

Date: 2026-07-19 · Branch: `feature/nuxt-4-migration` · Scope: `app/` (~2,450 lines), `nuxt.config.ts`, `CLAUDE.md`

This audit maps the actual structure, evaluates it against structure / consistency / Vue-Nuxt idioms / Vuetify / correctness axes, and ends with a phased remediation plan. No application code was changed.

Conventions confirmed with the owner before writing:

- The CLAUDE.md rule "do not abstract API calls into a service layer" is **disavowed** — shared fetch logic may move into composables.
- Hardcoded nl/en UI strings should be centralized (dictionary approach preferred unless full i18n adds real translation value — see F-20).
- Renames of store fields/getters are allowed; persisted keys (`videoLanguage`, `subtitleLanguage`) must not change.

---

## 1. Actual structure

### 1.1 Directory layout (as found)

```
app/
├── app.vue                      # Shell: app bar, <NuxtPage>, global dialogs, CastBar,
│                                #   dark-mode init, Cast init, ~90 lines of global CSS reset
├── assets/styles/settings.scss  # Vuetify SASS variable overrides
├── pages/
│   ├── index.vue                # / → /:browserLanguage redirect
│   └── [language]/[[videoId]].vue  # THE page: language selector, 4 category rows,
│                                   # language/translation fetching, open-video-from-URL
├── components/                  # Flat, except button/
│   ├── VideoCategory.vue        # Fetches one category, renders grid or swiper
│   ├── VideoGrid.vue            # v-row/v-col of VideoCards
│   ├── VideoSwiper.vue          # Swiper carousel of VideoCards
│   ├── VideoCard.vue            # Shared card (src, title, click)
│   ├── VideoDialog.vue          # 545 lines — player modal (see F-01)
│   ├── SearchDialog.vue         # 383 lines — search, pagination, link-paste parsing
│   ├── TranscriptPanel.vue      # 315 lines — VTT fetch/parse display, search, sync-scroll
│   ├── GetNotifiedDialog.vue    # WhatsApp channel promo
│   ├── CastBar.vue              # Global Chromecast control bar
│   └── button/
│       ├── Cast.vue             # <ButtonCast> — cast menu button
│       └── Transcript.vue       # <ButtonTranscript> — transcript toggle
├── composables/useCast.ts       # Cast SDK wrapper + ~110 lines of hand-written SDK types
├── config/whatsappChannels.ts   # Per-language channel data + its own interface
├── stores/app.ts                # Single flat Pinia store (state + set* mutations only)
├── types/index.ts               # Domain + search API types
└── utils/vtt.ts                 # parseVtt, formatCueTime (auto-imported)
```

### 1.2 Data flow

```
[[videoId]].vue (page)
  ├─ fetchLanguages()    → store.languages          (mediator /languages)
  ├─ fetchTranslations() → store.translations       (mediator /translations)
  └─ openVideoFromUrl()  → store.selectedVideo + store.videoDialog  (mediator /media-items)

VideoCategory ─ fetches its own category            (mediator /categories)
VideoGrid / VideoSwiper ─ click → store.selectedVideo + store.videoDialog
SearchDialog ─ fetches JWT + search results         (tokenUrl, searchUrl)
             ─ result click / pasted link → same media-items fetch → store
VideoDialog  ─ watches store.selectedVideo / videoLanguage / subtitleLanguage
             ─ fetches media-items per language, owns Plyr lifecycle,
             ─ owns URL push/pop for /:language/:videoId
TranscriptPanel ─ fetches + parses the VTT itself from a URL prop
useCast      ─ module-level shared refs; consumed by ButtonCast, CastBar, VideoDialog
```

The store is a passive value bag: every fetch lives in a component. State flows *into* the store from five different components, and routing state is written from two places (page watcher closes the dialog; VideoDialog pushes/pops the URL).

### 1.3 Where reality diverges from what the layout (and CLAUDE.md) implies

| # | Divergence | Evidence |
|---|---|---|
| D-1 | CLAUDE.md lists `subtitleMedia` as a store field; it is a local ref in VideoDialog | `CLAUDE.md` state table vs `app/components/VideoDialog.vue:163` |
| D-2 | CLAUDE.md says search page size is 12; code uses 9 | `app/components/SearchDialog.vue:149` |
| D-3 | CLAUDE.md says "TranscriptDialog" consumes `subtitleMedia`; the component is `TranscriptPanel` and takes a `vttUrl` prop instead | `app/components/TranscriptPanel.vue:101` |
| D-4 | `store.transcriptDialog` / `setTranscriptDialog` control a *panel*, not a dialog — naming predates the panel refactor | `app/stores/app.ts:28` |
| D-5 | CLAUDE.md forbids a service layer; owner disavowed the rule. The doc also still titles its API-notes section "Vuetify 3" while the project is on Vuetify 4 | `CLAUDE.md`, `package.json` (`vuetify ^4.0.5`) |
| D-6 | `composables/` implies reusable logic lives there, but only `useCast` exists; media fetching, player lifecycle, URL sync, and debouncing all live inline in components | see F-01…F-05 |
| D-7 | "All domain types in `types/index.ts`" — `WhatsAppChannel` lives in `config/whatsappChannels.ts:1`, and ~110 lines of Cast SDK types live in `composables/useCast.ts:12-118` | |
| D-8 | `app.vue` doubles as a global stylesheet: ~90 lines of CSS reset that belong in `assets/` | `app/app.vue:73-138` |

---

## 2. Findings

Severity: **high** = bug or structural problem that actively costs correctness/maintainability · **med** = should fix, contained impact · **low** = polish.

### 2.1 Structure

**F-01 · high — `VideoDialog.vue` is a god component (545 lines, five responsibilities).**
`app/components/VideoDialog.vue` owns: (1) media-items fetching per language (`loadMediaItems`, :245-275), (2) the entire Plyr lifecycle including a race-guard counter (`loadPlayer`, :327-397), (3) URL push/pop synchronization (:399-422), (4) raw-DOM injection of a transcript button into Plyr's control bar (:277-315), and (5) the download menu + language selectors in the template. Every watcher interacts with at least two of these concerns, which is why the file needs three explanatory comments about re-init races. Split: `usePlyrPlayer(playerEl, options)` composable (player lifecycle + transcript-button injection + load-id guard), `useMediaItems()` composable (fetching, see F-03), and a `VideoDownloadMenu.vue` component for the toolbar menu.

**F-02 · med — video-open routing logic is split across two files with a hidden mutual dependency.**
The page closes the dialog when `videoId` leaves the URL (`app/pages/[language]/[[videoId]].vue:149-154`); VideoDialog pushes/pops the URL when the dialog opens/closes (`app/components/VideoDialog.vue:399-422`). Each side both reads and writes the shared state the other watches — correctness depends on the guards (`route.params.videoId !== lank`, `if (!id && store.videoDialog)`) breaking the cycle. Move URL sync to one owner (a `useVideoRoute()` composable or the page).

**F-03 · med — the same media-items fetch is written three times.**
`openVideoFromUrl` (`[[videoId]].vue:117-132`), `fetchVideo` (`SearchDialog.vue:255-265`), and `loadMediaItems` (`VideoDialog.vue:245-275`) all call `/media-items/:code/:lank?clientType=www` and unwrap `media[0]`. Two of the three also do "set selectedVideo + open dialog". They differ in error handling (see F-27). Extract one `fetchMediaItem(langCode, lank)` and one `openVideo(video)` action.

**F-04 · med — "select video and open dialog" duplicated in four places.**
`VideoGrid.vue:27-30` and `VideoSwiper.vue:38-41` contain identical `onClickVideo`; `SearchDialog.vue:263-264` and `[[videoId]].vue:125-126` repeat the pair of store calls. This is store-shaped logic: a single `store.openVideo(video)` action removes all four.

**F-05 · med — the language `v-autocomplete` block is copy-pasted three times.**
`[[videoId]].vue:12-23`, `VideoDialog.vue:105-116` and `:120-131` share ~10 identical props (`density`, `hide-details`, `item-title`, `item-value`, `list-props`, `variant`, …) plus the duplicated `languageLabel` helper (`[[videoId]].vue:84-86`, `VideoDialog.vue:237-239`). Extract a `LanguageSelect.vue` (props: `items`, `icon`, `modelValue`) and move `languageLabel` to `utils/`.

**F-06 · med — two time formatters that do the same thing.**
`formatTime` (`CastBar.vue:197-209`) and `formatCueTime` (`utils/vtt.ts:55-63`) both render seconds as `H:MM:SS`/`M:SS`, differing only in negative-input handling. Merge into one `utils/time.ts` (`formatCueTime`'s home in `vtt.ts` is also misnamed — it isn't VTT-specific).

**F-07 · low — `whatsappChannel` lookup duplicated.**
`[[videoId]].vue:67` and `GetNotifiedDialog.vue:49-51` compute the same `whatsappChannels[store.siteLanguage]`. Belongs in the store or a tiny composable.

**F-08 · low — the `144p` file filter duplicated.**
`VideoDialog.vue:224-226` (`downloadableFiles`) and `button/Cast.vue:47-49` (`filteredFiles`) apply the same `label !== '144p'` filter under different names. One helper, one name.

**F-09 · low — misplaced type declarations.**
`WhatsAppChannel` in `config/whatsappChannels.ts:1-6` and the ~110-line Cast SDK surface in `composables/useCast.ts:12-118` contradict the "domain types in `types/index.ts`" convention. Move Cast types to `types/cast.ts` (they dwarf the composable's actual logic).

**F-10 · low — `app.vue` as stylesheet.**
`app/app.vue:73-161` carries the global CSS reset. Note the first `@layer vuetify-core.reset` block (:74-83) is entirely shadowed by the second block's `* { padding: 0; margin: 0; }` (:86-89) — dead CSS. Move the reset to `assets/styles/` and delete the redundant block.

### 2.2 Consistency

**F-11 · med — pervasive non-null assertions where the type should carry the guarantee.**
`store.getSiteLanguage!`, `getVideoLanguage!`, `getSubtitleLanguage!` appear ~15 times (e.g. `[[videoId]].vue:90,109`, `VideoDialog.vue:184,208,251,264,348-364,435-438`, `SearchDialog.vue:270,299`, `VideoCategory.vue:42`). The getters already fall back to `languages.value[0]` (`stores/app.ts:33-47`) and the array is seeded non-empty, so the value can never be undefined — only the inferred type says otherwise (array indexing). Type the getters as `Language` (e.g. via a typed fallback constant) and delete every `!` at the call sites.

**F-12 · med — store getter naming collides with state naming.**
`siteLanguage` (locale string) vs `getSiteLanguage` (resolved `Language` object) — same for video/subtitle (`stores/app.ts:16,33-47`). The `get` prefix reads like a function and hides that these are computeds; the real distinction is string-vs-object. Rename to e.g. `siteLocale` / `siteLanguage` or `siteLanguage` / `siteLanguageInfo`. (Renames approved; keep persisted keys `videoLanguage`/`subtitleLanguage` stable or map them in the persist config.)

**F-13 · med — `transcriptDialog` names a panel.**
`stores/app.ts:28`, `setTranscriptDialog`, and the CLAUDE.md table all say "dialog"; since commit `f786f08` it is a side/below panel inside VideoDialog. Rename to `transcriptPanel` / `setTranscriptPanel` (or `transcriptOpen`).

**F-14 · low — dialog chrome is styled three different ways.**
VideoDialog toolbar: `density="compact"`, no color (:9); SearchDialog: `color="primary"`, default density (:10); GetNotifiedDialog: `color="primary" density="compact"` (:4). Same close-button block is repeated in all three. Pick one toolbar recipe; optionally extract an `AppDialog` wrapper.

**F-15 · low — hardcoded strings bypass the translations system inconsistently.**
Four patterns coexist: `switch` on `siteLanguage` with nl/en cases (`app.vue:58-70`, `SearchDialog.vue:181-201`), English-only literals (`TranscriptPanel.vue:38` "No transcript available", `:53` "No results", `button/Transcript.vue:11` "Transcript", `button/Cast.vue:22` "Chromecast"), API translations with `??` fallback (`VideoDialog.vue:23`), and API translations with no fallback (`VideoDialog.vue:37,46` — renders `undefined (.vtt)` if translations fail to load). See F-20 for the fix.

**F-16 · low — grid column props drift.**
`VideoGrid.vue:3-9` uses `cols="12" lg="4" sm="6" xl="4"` (the `xl` is redundant — `lg` already applies upward); the page/category wrapper `cols="12" sm="12" xl="8"` (`[[videoId]].vue:4`, `VideoCategory.vue:3`) carries a redundant `sm="12"`. SearchDialog uses `cols="12" lg="4" sm="6"`. Harmless, but normalizing makes the intended breakpoints legible.

**F-17 · low — `Plyr` used as an implicit UMD global type.**
`VideoDialog.vue:158` types `player` as `Plyr` with no import; this only works because plyr declares `export as namespace Plyr`. Explicit `import type Plyr from 'plyr'` matches the project's "always import types explicitly" rule.

### 2.3 Vue / Nuxt idioms

**F-18 · med — page init duplicates its own watcher and skips validation.**
`[[videoId]].vue` has a `watch(language, …)` (:135-146) that validates the locale (redirect to `/en` if unknown) and refetches — but it runs with `immediate: false`, and `onMounted` (:156-170) re-implements the fetch half *without* the validation half. Consequence: a direct load of `/xyzzy` is never redirected; `siteLanguage` is set to the bogus locale, `getSiteLanguage` silently falls back to Dutch, and the URL stays wrong. Consolidate into the watcher with `{ immediate: true }` and validate after the language list arrives.

**F-19 · med — watchers keyed on a computed object instead of the source string.**
`VideoCategory.vue:55-62` and `SearchDialog.vue:346-353` watch `() => store.getSiteLanguage`, which produces a *new object* whenever `languages` is refetched (which the page does on every language change, plus twice at startup — `[[videoId]].vue:161-163`). VideoCategory defends with a `locale !== locale` guard; SearchDialog has no guard, so its reset fires on identity changes with an unchanged locale (currently benign because the query is usually empty, but it's a trap). Watch `() => store.siteLanguage` and both the guard and the trap disappear.

**F-20 · med — no strategy for locally-owned UI strings.**
Owner decision: centralize. Recommendation: **dictionary, not `@nuxtjs/i18n`.** The app's primary translation source is already the jw.org translations API (any locale, at runtime) — a full i18n module would govern only the ~10 shell strings and duplicate the existing locale routing (`/:language`). Add `app/config/uiStrings.ts` keyed by locale with an `en` fallback, plus a `t(key)` helper that resolves API translation → local dict → English. This also fixes every F-15 case and gives future translators one file to edit. If community translation of the shell via locale files ever becomes a goal, `@nuxtjs/i18n` can be adopted later; nothing in the dict approach blocks it.

**F-21 · low — `debounceTimer` needlessly reactive.**
`SearchDialog.vue:158` stores a `setTimeout` handle in a `ref`. Nothing renders from it; a plain module-scope `let` is correct. Also consider `useDebounceFn`-style extraction if a `useDebounce` composable appears anyway.

**F-22 · low — JWT fetched eagerly on app start.**
`SearchDialog.vue:355` runs `onMounted(fetchToken)`; the dialog is mounted from `app.vue`, so every visitor fetches a search token they may never use. Fetch lazily on first dialog open (the 401-retry path already covers expiry).

**F-23 · low — dead SSR guard.**
`pages/index.vue:4` guards `typeof navigator === 'undefined'` in an `ssr: false` app; `useCast.ts:172-174` guards `typeof window === 'undefined'` similarly. Harmless, but they imply an SSR path that doesn't exist.

**F-24 · low — dark mode is detected once and never tracked.**
`app.vue:54` reads `matchMedia` at mount only; OS theme changes mid-session are ignored. `usePreferredDark` behavior is a few lines: add a `change` listener on the media query.

### 2.4 Vuetify

**F-25 · low — magic numbers and inline styles where tokens/classes exist.**
`GetNotifiedDialog.vue:14` inline `style="font-size: 16px"` (→ `text-body-1`); `VideoDialog.vue:10` inline `word-break`/`user-select` style on the toolbar title and `:78` inline sizing on `<video>` (→ scoped classes); transcript panel width `340px` hardcoded four times (`VideoDialog.vue:476,483,523` and the split calc) — one CSS custom property; `CastBar.vue:219` `z-index: 10000` magic (documented, but should reference Vuetify's overlay z-index variable); dialog `max-width` literals `1240px/900px/1100px/480px` scattered. The theme itself defines only `primary` (`nuxt.config.ts`) — fine for this app's scale; the deliberate hardcoded colors (WhatsApp brand `#25D366`, image-overlay gradients) are acceptable as-is.

**F-26 · low — repeated section-wrapper layout.**
`v-row justify="center" > v-col cols="12" xl="8"` wraps both the page header (`[[videoId]].vue:3-4`) and every category (`VideoCategory.vue:2-3`). A `PageSection.vue` (or a layout class) would make the page's max-width policy single-sourced.

### 2.5 Logic / correctness

**F-27 · high — pasted-link and search-result opens have no error handling and can open an empty dialog.**
`SearchDialog.vue:255-265` (`fetchVideo`): no try/catch — a failed fetch from `onClickResult` (:298-300, un-awaited) or from the link-paste branches (:317-334) is an unhandled rejection and the UI silently does nothing. Worse, on an *empty* `media` array the code runs `store.setSelectedVideo(video!)` with `video === undefined` and still calls `setVideoDialog(true)`: the dialog opens over a `v-card v-if="store.selectedVideo"` that renders nothing — a blank overlay the user must dismiss. Compare `openVideoFromUrl` (`[[videoId]].vue:117-132`), which guards both. Unify via F-03's shared helper and surface a toast/alert on failure.

**F-28 · high — changing subtitle language rebuilds the player and loses playback position.**
`VideoDialog.vue:455-461` (subtitle watcher) → `loadMediaItems` toggles `loading` → `watch(loading)` (:392-397) → `loadPlayer` destroys the player and reassigns `player.source` (:340-388) — playback restarts at 0. Switching subtitles mid-video is the app's core feature; capture `player.currentTime` before rebuild and restore it (same courtesy applies to audio-language switches). Additionally, the rebuild path re-runs even when the subtitle fetch failed, silently dropping the previous track.

**F-29 · med — search has no stale-response guard.**
`fetchResponse` (`SearchDialog.vue:267-296`) applies whichever response resolves last. Debounce narrows the window for typing, but page changes (`currentPage` setter, :243-249) and sort changes fire immediately — a slow page-2 response can overwrite page 3, with `currentPage` then disagreeing with the rendered rows. Standard latest-wins token (like `playerLoadId` in VideoDialog) or `AbortController`.

**F-30 · med — page-level fetch failures are invisible.**
`[[videoId]].vue:143,163` wrap `fetchLanguages`/`fetchTranslations` in `Promise.allSettled` and never inspect the results; neither function has its own catch. On a failed initial load the page renders with a zero-width-space title, an empty category area (each `VideoCategory` also swallows its error into `category = null`, `VideoCategory.vue:46-53`), and no retry affordance. Decide on a user-visible failure state (alert + retry) at the page level.

**F-31 · med — `loadMediaItems` can fire with no selected video, producing a garbage request.**
`VideoDialog.vue:241-243`: `mediaUrl` interpolates `store.selectedVideo?.languageAgnosticNaturalKey`, which renders the literal string `undefined` into the URL when `selectedVideo` is null. The language watchers (:446-461) call `loadMediaItems` unguarded; today `selectedVideo` happens to be set whenever those selectors are visible, but the defensive branch at :256 (`if (!store.selectedVideo && media)`) shows the null case was anticipated — guard the entry point instead.

**F-32 · low — `jwOrgUrl` interpolates possibly-undefined values.**
`VideoDialog.vue:207-212` destructures from `store.selectedVideo ?? videoMedia.value ?? {}`; both fields become the string `"undefined"` in the query when absent. Low because the menu is only reachable with a loaded video, but the `?? {}` fallback admits the broken case — return `null` and disable the item instead.

**F-33 · low — brittle sort-label matching.**
`SearchDialog.vue:207-211` finds sort labels via `s.link.includes(key)` against hardcoded `['rel', 'newest', 'oldest']` — a substring match on an opaque URL. If the API renames a param this silently falls back to raw keys. Prefer parsing the `link` query (`URLSearchParams`) or matching `sorts[i].selected`.

**F-34 · low — clipboard copy gives no feedback and ignores failure.**
`TranscriptPanel.vue:212-214`: `navigator.clipboard.writeText` is fire-and-forget; on failure (permissions, insecure context) the user sees nothing either way. Minimal fix: brief check-icon swap or snackbar, `catch` ignored explicitly.

**F-35 · low — Plyr instance survives dialog close.**
`VideoDialog.vue:399-410`: closing calls `player.stop()` but never `destroy()`; the instance (and its media element buffers) persist until the next `loadPlayer`. Contained, but `destroy()` on close is cheaper than the comment-guarded re-init dance on reopen.

---

## 3. Target structure (proposed — for approval before any file is touched)

The destination tree for the aggressive restructure. New files are marked `NEW`; everything else is a move, split, or unchanged. The remediation plan in §4 lands files at these paths.

### 3.1 Target tree

```
app/
├── app.vue                            # Slim shell: app bar, <NuxtPage>, global overlays — no CSS payload
├── assets/
│   └── styles/
│       ├── settings.scss              # Vuetify SASS overrides (unchanged)
│       └── main.css                   # NEW — global reset + element styles, moved out of app.vue
├── pages/
│   ├── index.vue                      # unchanged
│   └── [language]/
│       └── [[videoId]].vue            # unchanged location; slimmed by useVideoRoute + utils/api
├── components/
│   ├── browse/                        # Category browsing surface
│   │   ├── VideoCategory.vue
│   │   ├── VideoGrid.vue
│   │   ├── VideoSwiper.vue
│   │   └── VideoCard.vue
│   ├── player/                        # Everything inside the video player modal
│   │   ├── VideoDialog.vue            # slimmed orchestrator (post F-01 split)
│   │   ├── VideoDownloadMenu.vue      # NEW — toolbar download menu, split from VideoDialog
│   │   ├── TranscriptPanel.vue
│   │   └── TranscriptButton.vue       # from button/Transcript.vue
│   ├── cast/                          # Chromecast domain
│   │   ├── CastBar.vue
│   │   └── CastButton.vue             # from button/Cast.vue
│   ├── search/
│   │   └── SearchDialog.vue
│   └── common/                        # Cross-domain building blocks
│       ├── LanguageSelect.vue         # NEW — deduped language autocomplete (F-05)
│       ├── PageSection.vue            # NEW — centered max-width section wrapper (F-26)
│       └── GetNotifiedDialog.vue
├── composables/                       # Stateful / lifecycle-bound logic only
│   ├── useCast.ts                     # logic only; SDK types move to types/cast.ts
│   ├── usePlyrPlayer.ts               # NEW — Plyr lifecycle, load-id guard, control injection (F-01)
│   ├── useMediaItems.ts               # NEW — videoMedia/subtitleMedia state + language watchers (F-01)
│   └── useVideoRoute.ts               # NEW — single owner of /:language/:videoId URL sync (F-02)
├── utils/                             # Pure functions, auto-imported
│   ├── api.ts                         # NEW — fetchLanguages/fetchTranslations/fetchCategory/
│   │                                  #        fetchMediaItem/fetchSearch/fetchToken (F-03)
│   ├── language.ts                    # NEW — languageLabel (F-05)
│   ├── time.ts                        # NEW — formatTime, merged from CastBar + vtt.ts (F-06)
│   └── vtt.ts                         # parseVtt only
├── config/                            # Hand-maintained data tables (not auto-imported)
│   ├── whatsappChannels.ts            # data only; interface moves to types/
│   └── uiStrings.ts                   # NEW — local UI-string dictionary (F-20)
├── stores/
│   ├── language.ts                    # languages, siteLanguage, videoLanguage, subtitleLanguage,
│   │                                  #   translations, t() resolution; persisted (key kept: 'app')
│   └── ui.ts                          # dialog/panel flags, selectedVideo, openVideo() action
└── types/
    ├── index.ts                       # domain: Language, Video, Category, MediaFile, Images,
    │                                  #   SubtitleCue, Translations, WhatsAppChannel
    ├── search.ts                      # search API response types (from index.ts)
    └── cast.ts                        # Cast SDK surface (from useCast.ts)
```

### 3.2 Rationale per top-level choice

- **`components/` by domain (`browse`/`player`/`cast`/`search`/`common`)** — the findings cluster by feature; a flat 11-file directory hides which components collaborate, and the `button/` folder was a grouping by widget-kind rather than by meaning.
- **`pathPrefix: false` in `nuxt.config.ts` components config** — keeps usage names identical to filenames (`<VideoDialog>`, `<CastButton>`) instead of Nuxt's path-derived names (`<PlayerVideoDialog>`); the accompanying rule is that component filenames must be globally unique.
- **`composables/` = stateful, `utils/` = pure** — the line that was missing: `useCast`/`usePlyrPlayer` hold refs and lifecycles; `api.ts`/`time.ts`/`vtt.ts` are side-effect-free functions. `utils/api.ts` *is* the light service layer (owner approved) — plain typed `$fetch` wrappers, no class, no shared mutable state.
- **`stores/` split into `language` + `ui`** — the current flat store mixes two unrelated lifecycles: persisted user preferences + fetched i18n data vs. ephemeral dialog/selection state. The persist config moves to `language.ts` with `key: 'app'` pinned so the existing cookie keeps working.
- **`types/` split** — a third of `index.ts` was search-API plumbing, and 110 lines of Cast SDK types were buried in a composable; three files restore "domain types at a glance".
- **`config/` stays non-auto-imported** — data tables (channels, UI strings) are edited by humans and should be imported explicitly so their consumers are greppable.
- **`assets/styles/main.css`** — `app.vue` stops doubling as the global stylesheet (F-10).
- **`pages/` unchanged** — the two-segment optional-param route is already the right shape for this app.

Considered and rejected: a global route middleware for locale validation (validation needs the async-fetched language list, so it stays in the page watcher, F-18); Nuxt layers or `features/` directories (overkill at ~2.5k lines); a class-based service layer (no shared auth/config state to justify one over plain functions).

### 3.3 Mapping: current file → destination

| Current | Destination | Notes |
|---|---|---|
| `app.vue` | `app.vue` | global CSS extracted to `assets/styles/main.css` |
| `assets/styles/settings.scss` | unchanged | |
| `pages/index.vue` | unchanged | |
| `pages/[language]/[[videoId]].vue` | unchanged | fetch logic → `utils/api.ts`, URL sync → `useVideoRoute` |
| `components/VideoCategory.vue` | `components/browse/VideoCategory.vue` | |
| `components/VideoGrid.vue` | `components/browse/VideoGrid.vue` | |
| `components/VideoSwiper.vue` | `components/browse/VideoSwiper.vue` | |
| `components/VideoCard.vue` | `components/browse/VideoCard.vue` | |
| `components/VideoDialog.vue` | `components/player/VideoDialog.vue` | **split**: → `VideoDownloadMenu.vue`, `usePlyrPlayer`, `useMediaItems`, `useVideoRoute` |
| `components/TranscriptPanel.vue` | `components/player/TranscriptPanel.vue` | |
| `components/button/Transcript.vue` | `components/player/TranscriptButton.vue` | usage `<ButtonTranscript>` → `<TranscriptButton>` |
| `components/button/Cast.vue` | `components/cast/CastButton.vue` | usage `<ButtonCast>` → `<CastButton>` |
| `components/CastBar.vue` | `components/cast/CastBar.vue` | |
| `components/SearchDialog.vue` | `components/search/SearchDialog.vue` | |
| `components/GetNotifiedDialog.vue` | `components/common/GetNotifiedDialog.vue` | |
| `composables/useCast.ts` | `composables/useCast.ts` | SDK type block → `types/cast.ts` |
| `config/whatsappChannels.ts` | `config/whatsappChannels.ts` | `WhatsAppChannel` interface → `types/index.ts` |
| `stores/app.ts` | **split**: `stores/language.ts` + `stores/ui.ts` | persist `key: 'app'` pinned; persisted field names unchanged |
| `types/index.ts` | **split**: `types/index.ts` + `types/search.ts` | |
| `utils/vtt.ts` | **split**: `utils/vtt.ts` + `utils/time.ts` | `formatCueTime` → `formatTime` |

---

## 4. Phased remediation plan

Each phase is independently reviewable and committable; structural moves precede cosmetic ones. Bug fixes go first because later refactors (Phase 3) will move the code they touch — fixing before moving keeps each diff reviewable. All new files from Phase 2 onward are created directly at their §3 target paths; pre-existing files are relocated in Phase 5 so the split diffs (Phase 3) stay readable against unmoved originals.

**Phase 1 — correctness fixes (no moves, no renames).**
F-27 (guard empty media + try/catch + user-visible failure), F-28 (preserve currentTime across player rebuild), F-29 (latest-wins guard in search), F-30 (page-level error state), F-31 (guard `loadMediaItems`), F-18 (merge onMounted into the language watcher, validate unknown locales), F-32.
*Verify: paste a bogus jw.org link; switch subtitles mid-playback; throttle network and change search pages; load `/xyzzy` directly.*

**Phase 2 — extract shared building blocks (pure deduplication, behavior identical).**
F-03/F-04 (single `fetchMediaItem` helper + `store.openVideo(video)` action; delete the four copies), F-05 (`LanguageSelect.vue` + `languageLabel` util), F-06 (`utils/time.ts`), F-07, F-08.
*Verify: open a video from grid, swiper, search result, pasted link, and direct URL — all five paths hit the same code.*

**Phase 3 — dismantle `VideoDialog.vue` (F-01, F-02).**
3a: `usePlyrPlayer` composable (player lifecycle, load-id guard, transcript-button injection, keydown-capture). 3b: `useMediaItems` composable (videoMedia/subtitleMedia state + watchers). 3c: `VideoDownloadMenu.vue`. 3d: move URL sync into a single owner (`useVideoRoute` or the page — pick one; delete the mirrored watcher). Land 3a–3d as separate commits.
*Verify: full `/verify` browser pass — open/close/reopen, back button, shareable URL, fullscreen + transcript.*

**Phase 4 — UI strings (F-20, F-15).**
Add `config/uiStrings.ts` + `t(key)` resolution (API translation → dict → en). Replace the switches in `app.vue`/`SearchDialog` and the English-only literals in `TranscriptPanel`, `button/Transcript`, `button/Cast`; add fallbacks where `store.translations.*` is used bare.

**Phase 5 — restructure to the §3 target tree (mechanical, reviewed as such).**
5a: relocate components into `browse/`/`player/`/`cast/`/`search/`/`common/`, set `pathPrefix: false`, rename `ButtonCast`/`ButtonTranscript` usages to `CastButton`/`TranscriptButton`. 5b: split `stores/app.ts` into `stores/language.ts` (+ persist with `key: 'app'` pinned) and `stores/ui.ts`. 5c: split `types/index.ts` → `types/search.ts`; move Cast SDK types → `types/cast.ts` (F-09); `WhatsAppChannel` → `types/index.ts`. 5d: renames — F-12 (`getSiteLanguage` → object-naming scheme), F-13 (`transcriptDialog` → `transcriptPanel`), F-11 (type getters as `Language`, delete `!` call sites), F-17 (explicit Plyr type import). Persisted field names and the `'app'` cookie key stay untouched.
*Verify: previously saved video/subtitle language selections still load from the existing cookie.*

**Phase 6 — cosmetic and Vuetify polish.**
F-10 (reset → `assets/`, delete dead layer block), F-14 (one dialog-toolbar recipe), F-16 (normalize grid props), F-21–F-24 (debounce var, lazy JWT, dead guards, dark-mode listener), F-25 (inline styles → classes, 340px → CSS var), F-26 (`PageSection` wrapper), F-33–F-35.

**Phase 7 — documentation sync.**
Update CLAUDE.md: remove the service-layer prohibition (owner-disavowed), fix D-1…D-5 (store table, LIMIT, transcript naming, Vuetify heading), replace the repository-structure section with the §3 target tree, document the two-store layout, the `pathPrefix: false` naming rule, the new composables/helpers from Phases 2–3, and the `uiStrings` convention from Phase 4.

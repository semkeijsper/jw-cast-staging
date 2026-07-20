# Restructure Log — Phases 2–7

Execution log for the autonomous run of `docs/AUDIT.md` §4, Phases 2–7. Phase 1 was completed and committed separately (`082cae5`).

## Gate definition

Per phase (after its final sub-commit): `pnpm lint` + `nuxi typecheck` + `pnpm build` **plus** scripted Playwright browser checks against the dev server, with screenshots under `docs/verify/phase-N/`. Browser-check results are recorded in each phase's log entry below.

## Manual checks remaining (NOT scriptable — please verify by hand)

- [ ] **Real Chromecast hardware:** casting a video, CastBar controls (play/pause/seek/volume/captions), subtitle rendering on the TV. Headless Chromium has no Cast SDK — `isAvailable` stays false, the cast button stays disabled; none of this path was browser-tested.
- [ ] **Native fullscreen:** fullscreen + transcript side panel layout, and Escape-in-fullscreen exiting fullscreen without closing the dialog. Headless fullscreen emulation is unreliable; not scripted.
- [ ] **Visual QA on real devices** for Phase 6 styling changes (toolbar recipe, spacing, mobile layout).

## Newly found / deferred

(items discovered mid-run are recorded here, not fixed)

---

## Phase 2 — shared building blocks

**Commits:** `6429900` (extraction), `d5fccff` (search-alert fix), `ec209be` (resume-position fix).

**Changed:**
- New `utils/api.ts` (typed `$fetch` wrappers: `fetchLanguages`, `fetchTranslations`, `fetchCategory`, `fetchMediaItem`, `fetchSearch`, `fetchToken`, plus shared `downloadableFiles` filter), `utils/language.ts` (`languageLabel`), `utils/time.ts` (`formatTime`), `components/common/LanguageSelect.vue`.
- Store gained `openVideo(video)` (replaces 4 copies of select+open) and `whatsappChannel` getter; **API base URLs moved out of the store into `utils/api.ts`** (decision — §3 target store layout has no URL fields, and constants aren't state).
- `formatCueTime` removed from `utils/vtt.ts`; CastBar's local `formatTime` deleted; both use `utils/time.ts`.
- `VideoCategory`, `SearchDialog`, `VideoDialog`, page all fetch through `utils/api.ts` now.

**Decisions:**
- `downloadableFiles` lives in `utils/api.ts` (no `utils/media.ts` in the §3 tree; avoided inventing a new path).
- `LanguageSelect` is used as `<CommonLanguageSelect>` until Phase 5a flips `pathPrefix: false` (Nuxt default path-prefixes subdirectory components).
- Two Phase 1 follow-up fixes surfaced by browser checks (still F-27/F-28 scope, committed separately):
  1. `d5fccff` — clearing `searchQuery` after a failed link paste re-triggered the query watcher and wiped the error alert.
  2. `ec209be` — position restore was bound to a stale element: Plyr's `source` setter replaces the media element asynchronously, so the `playerEl` ref and a `loadedmetadata`-only listener never restored. Now captured from the Plyr instance and re-seeked on Plyr `ready`.

**Browser checks** (dev server :3005, headless Chromium; note: Playwright Chromium has no H.264 decoder, so checks assert DOM/`currentTime` state, not rendered frames):
- Phase 1 retro (`docs/verify/phase-1/`): bogus locale `/xyzzy` → redirected to `/en` ✅ (`01-bogus-locale.png`); subtitle-language switch mid-playback preserved position 30s→32.6s ✅ (`02-subtitle-switch-position.png`); bogus pasted finder link → persistent error alert ✅ (`03-bogus-link-error.png`).
- Phase 2 (`docs/verify/phase-2/`): all five open paths pass — grid ✅ (`01-grid.png`), swiper ✅ (`02-swiper.png`), search result ✅ (`03-search-result.png`), pasted real finder link ✅ (`04-pasted-link.png`), direct URL ✅ (`05-direct-url.png`).

**Gate:** lint ✅ · typecheck ✅ · build ✅ · browser ✅

---

## Phase 3 — dismantle VideoDialog

**Commits:** `c7cb9ef` (3a `usePlyrPlayer`), `0a3141f` (3b `useMediaItems`), `5f03faa` (3c `VideoDownloadMenu`), `d344bbc` (3d `useVideoRoute`).

**Changed:**
- `composables/usePlyrPlayer.ts` — Plyr lifecycle, load-id race guard, resume-position capture/restore, transcript-control injection, fullscreen Escape capture. API: `localTime`, `loadPlayer`, `captureResume`, `resetResume`, `seekTo`, `stop`.
- `composables/useMediaItems.ts` — `videoMedia`/`subtitleMedia`/`loading` state, caption/subtitle URL computeds, selected-video and language watchers; `onBeforeLanguageReload` callback lets the player capture its position before a rebuild.
- `components/player/VideoDownloadMenu.vue` — toolbar download menu + `jwOrgUrl` computed (used as `<PlayerVideoDownloadMenu>` until 5a).
- `composables/useVideoRoute.ts` — single owner of `/:language/:videoId` sync, called from the page; the mirrored watchers in VideoDialog and the page are deleted. VideoDialog no longer touches the router at all.
- VideoDialog: 549 → 290 lines; only dialog chrome, language selectors, transcript wiring, and cast handoff remain.

**Browser checks** (`docs/verify/phase-3/`): open updates URL ✅ (`01-open.png`); close pops URL + dialog ✅ (`02-closed.png`); reopen re-initializes player ✅ (`03-reopen.png`); browser back closes dialog ✅ (`04-back.png`); transcript panel opens with 759 cues ✅ (`05-transcript.png`); transcript toggles off ✅. Phase 1 regression re-run post-refactor: all 3 still pass (position 30s→32.7s).

**Gate:** lint ✅ · typecheck ✅ · build ✅ · browser ✅

## Phase 4 — UI strings

**Commits:** `e629ecc`.

**Changed:**
- New `config/uiStrings.ts` — locale-keyed dictionary (en + nl) for all locally-owned shell strings, including fallbacks for the API keys used bare before (`btnDownload`, `hdgSubtitles`, `lnkHome`, `btnPlay`, tooltips).
- Store `t(key)` resolves API translation → `uiStrings[locale]` → `uiStrings.en` → key.
- Replaced: nl/en switches in `app.vue` (guide label) and `SearchDialog` (placeholder, error), Phase-1 strings in the page (loadFailed/retry), English-only literals in `TranscriptPanel` ("No transcript available", "No results"), `ButtonTranscript` ("Transcript"), `ButtonCast` ("Chromecast", play labels), `VideoDownloadMenu` bare `translations.*` reads.

**Decisions:**
- Dictionary over `@nuxtjs/i18n`, per audit F-20 and owner answer: the jw.org API is already the primary runtime translation source; a module would govern ~10 shell strings and duplicate the `/:language` routing. A future locale = one new block in `uiStrings.ts`.
- Guide button keeps dict-first resolution for nl/en (jw.org's `lnkHelpView` is a different phrase), API for other locales — same behavior as the old switch.
- App-bar search button keeps its `v-if="store.translations.lnkSearch"` guard so nothing flashes in English before translations load (behavior identical).

**Browser checks** (`docs/verify/phase-4/`): Dutch search placeholder from dict ✅ (`01-nl-search.png`); dialog buttons "Transcript" + "Afspelen" (API translation winning over dict, as designed) ✅ (`02-nl-dialog.png`); English placeholder on `/en` ✅ (`03-en-search.png`).

**Gate:** lint ✅ · typecheck ✅ · build ✅ · browser ✅

---

## Phase 5 — restructure to the §3 target tree

**Commits:** `5410da7` (5a pure component moves), `97fb1c3` (5a pathPrefix + usage renames), `8109585` (5b pure store rename), `37839e3` (5b store split), `ea831ae` (5c type splits), `48a53f2` (5d renames + assertion removal).

**Changed:**
- Components relocated as git renames into `browse/`, `player/`, `cast/`, `search/`, `common/`; `button/` directory removed. `pathPrefix: false` set; usages renamed: `ButtonCast`→`CastButton`, `ButtonTranscript`→`TranscriptButton`, `CommonLanguageSelect`→`LanguageSelect`, `PlayerVideoDownloadMenu`→`VideoDownloadMenu`.
- `stores/app.ts` → `stores/language.ts` (git rename) then split: `useLanguageStore` (languages, locales, translations, `t()`, whatsappChannel, prefs; persist `key: 'app'` pinned) + `useUiStore` (dialog flags, `selectedVideo`, `openVideo`). All 15 consumers rewritten.
- Types: search API types → `types/search.ts`; Cast SDK surface → `types/cast.ts`; `WhatsAppChannel` → `types/index.ts`.
- 5d renames: `getSiteLanguage`/`getVideoLanguage`/`getSubtitleLanguage` → `siteLanguageInfo`/`videoLanguageInfo`/`subtitleLanguageInfo`, typed `computed<Language>` (one `[0]!` inside the store), all ~15 call-site `!` assertions deleted; `transcriptDialog`/`setTranscriptDialog` → `transcriptPanel`/`setTranscriptPanel`. F-17 (explicit Plyr type import) had already landed with 3a.

**Decisions:**
- Getter naming: `…Info` suffix chosen over `siteLocale`/`siteLanguage` because the persisted fields `videoLanguage`/`subtitleLanguage` cannot be renamed, so string state keeps its names and the object getters get the suffix — one uniform pattern.
- Store split runs `useLanguageStore()` + `useUiStore()` side by side in files needing both; no facade store kept.

**Browser checks** (`docs/verify/phase-5/`): **hard invariant verified** — a pre-split `app` cookie (`{"videoLanguage":"de","subtitleLanguage":"en"}`) seeded before load restores "Duits (Deutsch)" audio + "Engels (English)" subtitles in the dialog selectors ✅ (`01-cookie-restore.png`). Phase 3 regression suite re-run: all 6 pass.

**Gate:** lint ✅ · typecheck ✅ · build ✅ · browser ✅

---

## Phase 6 — cosmetic and Vuetify polish

**Commits:** `3a97e43`.

**Changed:** F-10 (reset → `assets/styles/main.css`, dead `@layer` block deleted, loaded via `nuxt.config` css array), F-14 (all three dialog toolbars now `color="primary" density="compact"` — VideoDialog's toolbar gains the primary color, a visible change), F-16 (dropped redundant `xl="4"`/`sm="12"` grid props), F-21 (debounce handle is a plain `let`), F-22 (JWT fetched on first search open), F-23 (dead SSR guards removed), F-24 (OS theme `change` listener), F-25 (inline styles → classes; transcript width via `--transcript-width`), F-26 (`PageSection.vue` wraps the centered `cols=12 xl=8` layout in the page and VideoCategory), F-33 (`URLSearchParams` sort-key parse), F-34 (copy button check-icon feedback + explicit catch), F-35 (Plyr `destroy()` on dialog close instead of `stop()`).

**Decisions:**
- CastBar `z-index: 10000` kept as-is: Vuetify 4 exposes no overlay z-index CSS variable to reference; the explanatory comment stays (F-25 sub-item, deliberately not changed).
- Dialog `max-width` literals (1240/900/1100/480) left in place — F-25 lists them but prescribes no token; inventing one adds indirection for four one-off values.

**Browser checks** (`docs/verify/phase-6/`): OS theme flip light→dark updates `v-theme--dark` live ✅ (`01-dark-theme.png`); transcript copy shows check feedback ✅ (`02-copy-feedback.png`). Regressions: phase-1 suite (3/3, position preserved) and phase-3 suite (6/6 — including reopen-after-close, which now exercises the new `destroy()` path) all pass.

**Gate:** lint ✅ · typecheck ✅ · build ✅ · browser ✅

---

## Phase 7 — documentation sync

**Commits:** `51b8572`.

**Changed:** CLAUDE.md fully synced with the restructured codebase — target tree replaces the old structure section; two-store layout documented with the pinned `'app'` persist key called out as untouchable; `pathPrefix: false` naming rule; `utils/api.ts` wrapper convention (service-layer prohibition removed, per owner); `uiStrings`/`t()` convention; player composables and `useVideoRoute` ownership; search `LIMIT` corrected to 9; JWT documented as lazy; "Vuetify 3 API Notes" heading now "Vuetify 4". Fixes audit divergences D-1…D-5.

**Gate:** lint ✅ · typecheck ✅ · build ✅ (docs-only phase; browser suites last ran green after Phase 6)

---

## Final summary — all phases complete

Phases 2–7 executed autonomously; every phase gate (lint + vue-tsc typecheck + production build + Playwright browser checks) passed. Both hard invariants held: persisted fields `videoLanguage`/`subtitleLanguage` and the `'app'` cookie key are unchanged and cookie restore is browser-verified; no renames beyond those the audit specifies. Nothing was added to "Newly found / deferred" — the only mid-run discoveries were two defects in Phase 1's own fixes (F-27/F-28 scope), fixed and logged under Phase 2.

**Complete commit list (oldest first):**

| Phase | Commits |
|---|---|
| 1 (prior session) | `082cae5` |
| 2 | `6429900`, `d5fccff`, `ec209be`, `270e449` (log) |
| 3 | `c7cb9ef` (3a), `0a3141f` (3b), `5f03faa` (3c), `d344bbc` (3d), `41035b4` (log) |
| 4 | `e629ecc`, `bfbe521` (log) |
| 5 | `5410da7` (5a moves), `97fb1c3` (5a fixes), `8109585` (5b move), `37839e3` (5b split), `ea831ae` (5c), `48a53f2` (5d), `0a5746e` (log) |
| 6 | `3a97e43`, `82c3c55` (log) |
| 7 | `51b8572`, plus this log commit |

Please run the "Manual checks remaining" list at the top of this file (Chromecast hardware, native fullscreen, visual QA).

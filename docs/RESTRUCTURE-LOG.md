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

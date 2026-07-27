import type { Page } from 'playwright-core';
import type { Language } from '~/types';
import { languageLabel } from '~/utils/language';

// Duplicated from utils/api.ts on purpose: that module is written against
// Nuxt's auto-imported $fetch and cannot be imported from plain Node.
const MEDIATOR_URL = 'https://b.jw-cdn.org/apis/mediator/v1';

// An evergreen "Bible Teachings" short, translated into 400+ languages. Pinned
// rather than clicking whatever the catalog lists first, so the specs do not
// depend on jw.org's weekly rotation.
export const VIDEO_LANK = 'pub-ebtv_1_VIDEO';
export const SITE_LOCALE = 'nl';
export const SITE_CODE = 'O';

export interface PlayerState {
  currentTime: number;
  paused: boolean;
  readyState: number;
  /** `kind:language` for every text track the browser is currently reading */
  activeTracks: string[];
  /** `kind:srclang` for every <track> element on the media */
  trackEls: string[];
  captionText: string;
  captionsActive: boolean;
  /** False once Plyr has replaced the media element, i.e. the source reloaded */
  sameMedia: boolean;
  /** How often the media element was emptied since it was marked */
  emptied: number;
}

interface MediaItem {
  files: { subtitles?: { url?: string } }[];
  availableLanguages: string[];
}

async function mediaItem(code: string, lank: string): Promise<MediaItem | undefined> {
  const response = await fetch(`${MEDIATOR_URL}/media-items/${code}/${lank}?clientType=www`);
  const { media } = await response.json() as { media?: MediaItem[] };
  return media?.[0];
}

function hasSubtitles(item: MediaItem | undefined) {
  return Boolean(item?.files.some(f => f.subtitles?.url));
}

/**
 * Resolves the exact option labels the language selects will render, and finds
 * a language this video exists in but has no subtitle file for. Both are read
 * from the same API the app uses, so the specs never hardcode jw.org's copy or
 * assume which translations happen to carry subtitles today.
 */
export async function resolveLanguages(locales: string[]) {
  const response = await fetch(`${MEDIATOR_URL}/languages/${SITE_CODE}/all?clientType=www`);
  const { languages } = await response.json() as { languages: Language[] };

  const labels: Record<string, string> = {};
  for (const locale of locales) {
    const language = languages.find(l => l.locale === locale);
    if (!language) {
      throw new Error(`jw.org no longer lists a language with locale "${locale}"`);
    }
    labels[locale] = languageLabel(language);
  }

  const item = await mediaItem(SITE_CODE, VIDEO_LANK);
  if (!item) {
    throw new Error(`${VIDEO_LANK} is no longer available in ${SITE_CODE}`);
  }

  const byCode = new Map(languages.map(l => [l.code, l]));
  let withoutSubtitles: string | undefined;
  for (const code of item.availableLanguages) {
    const language = byCode.get(code);
    if (!language || locales.includes(language.locale)) {
      continue;
    }
    if (!hasSubtitles(await mediaItem(code, VIDEO_LANK))) {
      withoutSubtitles = languageLabel(language);
      break;
    }
  }
  if (!withoutSubtitles) {
    throw new Error(`every language of ${VIDEO_LANK} now has subtitles`);
  }

  return { labels, withoutSubtitles };
}

/** Waits for Plyr, then starts muted playback (autoplay is unblocked by a launch flag) */
export async function startPlayback(page: Page) {
  await page.waitForSelector('.plyr video', { timeout: 60_000 });
  await page.waitForFunction(
    () => (document.querySelector('.plyr video') as HTMLVideoElement | null)?.readyState ?? 0 >= 2,
    null,
    { timeout: 60_000 },
  );
  await page.evaluate(async() => {
    const video = document.querySelector('.plyr video') as HTMLVideoElement;
    video.muted = true;
    await video.play();
  });
  await page.waitForFunction(
    () => ((document.querySelector('.plyr video') as HTMLVideoElement | null)?.currentTime ?? 0) > 1,
    null,
    { timeout: 30_000 },
  );
}

/**
 * Tags the current media element and starts counting `emptied` on it, so a
 * later read can tell an in-place track swap from a source reload.
 */
export async function markMedia(page: Page) {
  await page.evaluate(() => {
    const video = document.querySelector('.plyr video') as HTMLVideoElement & { __mark?: string };
    const probe = { mark: `mark-${Math.random()}`, emptied: 0 };
    (window as unknown as { __probe: typeof probe }).__probe = probe;
    video.__mark = probe.mark;
    video.addEventListener('emptied', () => {
      probe.emptied += 1;
    });
  });
}

export function playerState(page: Page): Promise<PlayerState> {
  return page.evaluate(() => {
    const video = document.querySelector('.plyr video') as HTMLVideoElement & { __mark?: string };
    const probe = (window as unknown as { __probe?: { mark: string; emptied: number } }).__probe;
    return {
      currentTime: video.currentTime,
      paused: video.paused,
      readyState: video.readyState,
      activeTracks: [...video.textTracks]
        .filter(t => t.mode !== 'disabled')
        .map(t => `${t.kind}:${t.language}`),
      trackEls: [...video.querySelectorAll('track')].map(t => `${t.kind}:${t.srclang}`),
      captionText: document.querySelector('.plyr__captions')?.textContent ?? '',
      captionsActive: Boolean(document.querySelector('.plyr')?.classList.contains('plyr--captions-active')),
      sameMedia: Boolean(probe) && video.__mark === probe!.mark,
      emptied: probe?.emptied ?? 0,
    };
  });
}

/** Picks an option in one of the dialog's language autocompletes */
export async function pickLanguage(page: Page, icon: 'mdi-volume-high' | 'mdi-subtitles', label: string) {
  const input = page.locator(`.v-input:has(.${icon}) input[type="text"]`).first();
  await input.click();
  await input.fill(label);
  const option = page.locator('.v-overlay-container .v-list-item', { hasText: label }).first();
  await option.waitFor({ state: 'visible', timeout: 15_000 });
  await option.click();
  // Let the media-item fetch and the resulting track swap start
  await page.waitForTimeout(500);
}

/** Waits until the media carries a subtitles track for `locale`, or none at all */
export async function waitForSubtitleTrack(page: Page, locale: string | null) {
  await page.waitForFunction(
    expected => {
      const video = document.querySelector('.plyr video');
      const track = video?.querySelector('track[kind="subtitles"]');
      return expected === null ? !track : track?.getAttribute('srclang') === expected;
    },
    locale,
    { timeout: 30_000 },
  );
}

/** Waits for Plyr to paint a cue from the track for `locale` */
export async function waitForCues(page: Page, locale: string) {
  await page.waitForFunction(
    expected => {
      const video = document.querySelector('.plyr video') as HTMLVideoElement | null;
      const active = [...(video?.textTracks ?? [])].some(t => t.kind === 'subtitles' && t.language === expected && t.mode !== 'disabled');
      return active && (document.querySelector('.plyr__captions')?.textContent ?? '').trim().length > 0;
    },
    locale,
    { timeout: 30_000 },
  );
}

/** Clicks a Plyr control directly — its control bar auto-hides during playback */
export function clickPlyrControl(page: Page, selector: string) {
  return page.evaluate(sel => (document.querySelector(sel) as HTMLElement).click(), selector);
}

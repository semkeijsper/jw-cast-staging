import type { Page } from 'playwright-core';
import { createPage, setup } from '@nuxt/test-utils/e2e';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  clickPlyrControl,
  markMedia,
  pickLanguage,
  playerState,
  resolveLanguages,
  SITE_LOCALE,
  startPlayback,
  VIDEO_LANK,
  waitForCues,
  waitForSubtitleTrack,
} from './helpers';

// Empty (E2E_BROWSER_CHANNEL="") falls back to Playwright's bundled Chromium,
// which has to be installed separately; the default drives the installed Edge.
const channel = process.env.E2E_BROWSER_CHANNEL ?? 'msedge';

/**
 * Covers what unit tests structurally cannot: that a subtitle-language switch
 * swaps the <track> on the live media instead of rebuilding the player. It
 * needs a real media pipeline (text tracks, cue rendering, buffered playback),
 * so it runs a real browser against jw.org's live API.
 *
 * The specs share one player session and run in order — each starts from where
 * the previous one left off.
 */
describe('video player', async () => {
  await setup({
    browser: true,
    browserOptions: {
      type: 'chromium',
      launch: {
        ...(channel ? { channel } : {}),
        // Playback has to start without a click; the specs drive video.play()
        args: ['--autoplay-policy=no-user-gesture-required'],
      },
    },
  });

  let page: Page;
  let labels: Record<string, string>;
  let noSubtitleLanguage: string;
  let openedTitle: string;

  beforeAll(async () => {
    ({ labels, withoutSubtitles: noSubtitleLanguage } = await resolveLanguages([SITE_LOCALE, 'es']));

    // Desktop viewport: the transcript control is only injected above smAndDown
    page = await createPage(`/${SITE_LOCALE}/${VIDEO_LANK}`, {
      viewport: { width: 1440, height: 900 },
    });
    await startPlayback(page);
    openedTitle = (await page.locator('.dialog-title').first().textContent()) ?? '';
    await markMedia(page);
  }, 300_000);

  afterAll(async () => {
    await page?.close();
  });

  it('swaps the subtitle track in place, without reloading the media', async () => {
    const before = await playerState(page);
    expect(before.trackEls).toContain(`subtitles:${SITE_LOCALE}`);

    await pickLanguage(page, 'mdi-subtitles', labels.es!);
    await waitForSubtitleTrack(page, 'es');
    await waitForCues(page, 'es');

    const after = await playerState(page);
    expect(after.sameMedia).toBe(true);
    expect(after.emptied).toBe(0);
    expect(after.paused).toBe(false);
    expect(after.currentTime).toBeGreaterThan(before.currentTime);
    expect(after.activeTracks).toContain('subtitles:es');
    expect(after.captionText.trim()).not.toBe('');
  });

  it('drops the track for a language that has no subtitles, still without reloading', async () => {
    await pickLanguage(page, 'mdi-subtitles', noSubtitleLanguage);
    await waitForSubtitleTrack(page, null);

    const after = await playerState(page);
    expect(after.sameMedia).toBe(true);
    expect(after.emptied).toBe(0);
    expect(after.paused).toBe(false);
  });

  it('re-activates cues when switching back to a language that has them', async () => {
    await pickLanguage(page, 'mdi-subtitles', labels[SITE_LOCALE]!);
    await waitForSubtitleTrack(page, SITE_LOCALE);
    await waitForCues(page, SITE_LOCALE);

    const after = await playerState(page);
    expect(after.sameMedia).toBe(true);
    expect(after.emptied).toBe(0);
    expect(after.activeTracks).toContain(`subtitles:${SITE_LOCALE}`);
  });

  it('keeps a manual captions toggle across a subtitle switch', async () => {
    await clickPlyrControl(page, '.plyr__control[data-plyr="captions"]');
    await page.waitForFunction(
      () => !document.querySelector('.plyr')?.classList.contains('plyr--captions-active'),
      null,
      { timeout: 10_000 },
    );

    await pickLanguage(page, 'mdi-subtitles', labels.es!);
    await waitForSubtitleTrack(page, 'es');

    const off = await playerState(page);
    expect(off.captionsActive).toBe(false);
    expect(off.paused).toBe(false);

    // Turning them back on must show the language that was picked while off
    await clickPlyrControl(page, '.plyr__control[data-plyr="captions"]');
    await waitForCues(page, 'es');
    expect((await playerState(page)).captionsActive).toBe(true);
  });

  it('keeps the playback position across an audio-language switch', async () => {
    const before = await playerState(page);

    // A different audio language is a different file, so this one does reload
    await pickLanguage(page, 'mdi-volume-high', labels[SITE_LOCALE]!);
    await page.waitForFunction(
      expected => {
        const video = document.querySelector('.plyr video') as HTMLVideoElement | null;
        const track = video?.querySelector('track[kind="captions"]');
        return track?.getAttribute('srclang') === expected && (video?.readyState ?? 0) >= 2;
      },
      SITE_LOCALE,
      { timeout: 60_000 },
    );

    const after = await playerState(page);
    expect(after.currentTime).toBeGreaterThan(before.currentTime - 1);
    expect(after.currentTime).toBeLessThan(before.currentTime + 5);
    // The control bar is rebuilt by Plyr's source setter; ours must come back
    expect(await page.locator('.plyr__control--transcript').count()).toBe(1);
  });

  it('resumes where it left off when the same video is reopened', async () => {
    await page.evaluate(async () => {
      await (document.querySelector('.plyr video') as HTMLVideoElement).play();
    });
    await page.waitForTimeout(2000);
    const before = await playerState(page);

    await page.locator('.v-toolbar .mdi-close').first().click();
    await page.waitForSelector('.plyr video', { state: 'detached', timeout: 15_000 });

    await page.locator('.video-card').first().click();
    await page.waitForSelector('.plyr video', { timeout: 60_000 });
    // The reopened video is only the same one if the card we clicked was it
    const reopened = (await page.locator('.dialog-title').first().textContent()) ?? '';
    if (reopened !== openedTitle) {
      // A different video: it must start from the beginning instead
      await page.waitForFunction(
        () => ((document.querySelector('.plyr video') as HTMLVideoElement | null)?.readyState ?? 0) >= 2,
        null,
        { timeout: 60_000 },
      );
      expect((await playerState(page)).currentTime).toBeLessThan(1.5);
      return;
    }

    await page.waitForFunction(
      () => ((document.querySelector('.plyr video') as HTMLVideoElement | null)?.currentTime ?? 0) > 0,
      null,
      { timeout: 30_000 },
    );
    expect((await playerState(page)).currentTime).toBeGreaterThan(before.currentTime - 2);
  });

  it('starts a different video from the beginning', async () => {
    const current = (await page.locator('.dialog-title').first().textContent()) ?? '';
    await page.locator('.v-toolbar .mdi-close').first().click();
    await page.waitForSelector('.plyr video', { state: 'detached', timeout: 15_000 });

    const cards = page.locator('.video-card');
    for (let i = 0; i < 3; i += 1) {
      await cards.nth(i).click();
      await page.waitForSelector('.plyr video', { timeout: 60_000 });
      if (((await page.locator('.dialog-title').first().textContent()) ?? '') !== current) {
        break;
      }
      await page.locator('.v-toolbar .mdi-close').first().click();
      await page.waitForSelector('.plyr video', { state: 'detached', timeout: 15_000 });
    }

    await page.waitForFunction(
      () => ((document.querySelector('.plyr video') as HTMLVideoElement | null)?.readyState ?? 0) >= 2,
      null,
      { timeout: 60_000 },
    );
    expect((await playerState(page)).currentTime).toBeLessThan(1.5);
  });
});

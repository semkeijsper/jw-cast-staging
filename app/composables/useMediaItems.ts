import type { Video } from '~/types';

/**
 * Holds the media items backing the video dialog: the audio-language media
 * (`videoMedia`) and the subtitle-language media (`subtitleMedia`), refetched
 * when the selected video or either language changes.
 *
 * `onBeforeLanguageReload` runs before a language switch clears the media —
 * the player uses it to capture the playback position it should restore.
 */
export function useMediaItems(onBeforeLanguageReload?: () => void) {
  const languageStore = useLanguageStore();
  const uiStore = useUiStore();

  const loading = ref(true);
  const videoMedia = ref<Video | null>(null);
  const subtitleMedia = ref<Video | null>(null);

  const captionUrl = computed(() => {
    const found = videoMedia.value?.files.find(f => f?.subtitles?.url);
    return found?.subtitles?.url ?? null;
  });

  const subtitleUrl = computed(() => {
    const found = subtitleMedia.value?.files.find(f => f?.subtitles?.url);
    return found?.subtitles?.url ?? null;
  });

  async function loadMediaItems() {
    if (!uiStore.selectedVideo) {
      return;
    }
    const { languageAgnosticNaturalKey: lank } = uiStore.selectedVideo;
    loading.value = true;
    const requests: Promise<void>[] = [];

    if (!videoMedia.value) {
      requests.push(
        fetchMediaItem(languageStore.videoLanguageInfo.code, lank).then(media => {
          if (media) {
            videoMedia.value = media;
          }
        }),
      );
    }
    if (!subtitleMedia.value) {
      requests.push(
        fetchMediaItem(languageStore.subtitleLanguageInfo.code, lank).then(media => {
          if (media) {
            subtitleMedia.value = media;
          }
        }),
      );
    }

    await Promise.allSettled(requests);
    loading.value = false;
  }

  // New video selected — reset and reload
  watch(
    () => uiStore.selectedVideo,
    video => {
      if (!video) {
        return;
      }
      videoMedia.value = null;
      subtitleMedia.value = null;
      // Pre-fill from selectedVideo if language matches
      if (languageStore.siteLanguageInfo.locale === languageStore.videoLanguageInfo.locale) {
        videoMedia.value = video;
      }
      if (languageStore.siteLanguageInfo.locale === languageStore.subtitleLanguageInfo.locale) {
        subtitleMedia.value = video;
      }
      loadMediaItems();
    },
  );

  // Audio language changed
  watch(
    () => languageStore.videoLanguage,
    () => {
      onBeforeLanguageReload?.();
      videoMedia.value = null;
      loadMediaItems();
    },
  );

  // Subtitle language changed
  watch(
    () => languageStore.subtitleLanguage,
    () => {
      onBeforeLanguageReload?.();
      subtitleMedia.value = null;
      loadMediaItems();
    },
  );

  return { loading, videoMedia, subtitleMedia, captionUrl, subtitleUrl };
}

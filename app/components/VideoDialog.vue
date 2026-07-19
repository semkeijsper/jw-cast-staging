<template>
  <v-dialog
    v-model="dialog"
    :fullscreen="smAndDown"
    :max-width="store.transcriptDialog && !smAndDown ? '1240px' : '900px'"
    transition="dialog-bottom-transition"
  >
    <v-card v-if="store.selectedVideo">
      <v-toolbar density="compact">
        <v-toolbar-title style="word-break: normal; user-select: none;">
          {{ `${store.selectedVideo.title} (${store.selectedVideo.durationFormattedHHMM})` }}
        </v-toolbar-title>

        <template #append>
          <v-menu location="bottom end" transition="slide-y-transition">
            <template #activator="{ props }">
              <v-btn icon v-bind="props">
                <v-icon>mdi-download</v-icon>
              </v-btn>
            </template>

            <v-list density="compact">
              <v-list-subheader>{{ store.translations.btnDownload ?? 'Download' }}</v-list-subheader>

              <v-list-item
                v-for="file in downloadableFiles(videoMedia)"
                :key="file.checksum"
                :href="file.progressiveDownloadURL"
                prepend-icon="mdi-download"
                :title="`${file.label} (${Math.floor(file.filesize / 1048576)} MB)`"
              />

              <v-list-item
                :disabled="!subtitleUrl"
                :href="subtitleUrl ?? undefined"
                prepend-icon="mdi-download"
                :title="`${store.translations.hdgSubtitles} (.vtt)`"
              />

              <v-divider class="my-1" />

              <v-list-item
                :disabled="!jwOrgUrl"
                :href="jwOrgUrl ?? undefined"
                prepend-icon="mdi-open-in-new"
                target="_blank"
                :title="store.translations.lnkHome"
              />
            </v-list>
          </v-menu>

          <v-btn icon @click="dialog = false">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </template>
      </v-toolbar>

      <!-- Loading state -->
      <v-responsive v-if="loading || !videoMedia" :aspect-ratio="16 / 9" class="player-frame">
        <v-container fill-height fluid>
          <v-row justify="center">
            <v-col class="d-flex justify-center">
              <v-progress-circular color="primary" indeterminate size="48" />
            </v-col>
          </v-row>
        </v-container>
      </v-responsive>

      <!-- Player -->
      <template v-else>
        <div class="player-row" :class="{ 'player-row--split': store.transcriptDialog && !smAndDown }">
          <v-responsive :aspect-ratio="16 / 9" class="player-frame">
            <video
              ref="playerEl"
              controls
              crossorigin="anonymous"
              playsinline
              :poster="videoPoster"
              style="width: 100%; height: 100%; object-fit: cover"
            />
          </v-responsive>

          <TranscriptPanel
            v-if="store.transcriptDialog && !smAndDown"
            class="transcript-side"
            :current-time="transcriptTime"
            :vtt-url="subtitleUrl"
            @seek="onSeekTranscript"
          />
        </div>

        <TranscriptPanel
          v-if="store.transcriptDialog && smAndDown"
          class="transcript-below"
          closable
          :current-time="transcriptTime"
          :vtt-url="subtitleUrl"
          @seek="onSeekTranscript"
        />
      </template>

      <v-card-text v-if="!(store.transcriptDialog && smAndDown)" class="px-3 pb-3 pt-0">
        <v-container class="pa-3">
          <v-row :no-gutters="xs">
            <v-col cols="12" sm="6">
              <CommonLanguageSelect
                v-model="videoLanguage"
                class="mt-4"
                icon="mdi-volume-high"
                :items="availableLanguages"
              />
            </v-col>

            <v-col cols="12" sm="6">
              <CommonLanguageSelect
                v-model="subtitleLanguage"
                class="mt-4"
                icon="mdi-subtitles"
                :items="availableLanguages"
              />
            </v-col>
          </v-row>
        </v-container>

        <v-card-actions>
          <ButtonCast :subtitle-media="subtitleMedia" :subtitle-url="subtitleUrl" :video-media="videoMedia" />
          <v-spacer />
          <ButtonTranscript :subtitle-media="subtitleMedia" :subtitle-url="subtitleUrl" />
        </v-card-actions>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import type { Video } from '~/types';
import { useDisplay } from 'vuetify';

const store = useAppStore();
const route = useRoute();
const router = useRouter();
const { xs, smAndDown } = useDisplay();
const { isCastConnected, isMediaLoaded, currentTime: castTime, seekTo: castSeekTo } = useCast();

const playerEl = ref<HTMLVideoElement | null>(null);

const { loading, videoMedia, subtitleMedia, captionUrl, subtitleUrl }
  = useMediaItems(() => captureResume());

const isCasting = computed(() => isCastConnected.value && isMediaLoaded.value);
const transcriptTime = computed(() => (isCasting.value ? castTime.value : localTime.value));

function onSeekTranscript(seconds: number) {
  if (isCasting.value) {
    castSeekTo(seconds);
  }
  else {
    playerSeekTo(seconds);
  }
}

const dialog = computed({
  get: () => store.videoDialog,
  set: v => store.setVideoDialog(v),
});

const videoLanguage = computed({
  get: () => store.getVideoLanguage!.locale,
  set: (v: string) => {
    if (!v) {
      return;
    }
    store.setVideoLanguage(v);
  },
});

const subtitleLanguage = computed({
  get: () => store.getSubtitleLanguage!.locale,
  set: (v: string) => {
    if (!v) {
      return;
    }
    store.setSubtitleLanguage(v);
  },
});

const videoPoster = computed(
  () => (store.selectedVideo ?? videoMedia.value)?.images.wss.lg,
);

const jwOrgUrl = computed(() => {
  const video = store.selectedVideo ?? videoMedia.value;
  if (!video) {
    return null;
  }
  const { locale } = store.getSiteLanguage!;
  return `https://www.jw.org/finder?locale=${locale}&category=${video.primaryCategory}&lank=${video.languageAgnosticNaturalKey}`;
});

const availableLanguages = computed(() => {
  if (!store.selectedVideo) {
    return [];
  }
  return store.languages.filter(l =>
    store.selectedVideo!.availableLanguages.includes(l.code),
  );
});

const {
  localTime,
  loadPlayer,
  captureResume,
  resetResume,
  seekTo: playerSeekTo,
  stop: stopPlayer,
} = usePlyrPlayer(playerEl, { videoMedia, captionUrl, subtitleUrl, poster: videoPoster });

// Re-init player once media is loaded
watch(loading, async isLoading => {
  if (!isLoading) {
    await nextTick();
    loadPlayer();
  }
});

// Stop playback when dialog closes; update URL
watch(
  () => store.videoDialog,
  open => {
    if (!open) {
      stopPlayer();
      store.setTranscriptDialog(false);
      const lang = route.params.language as string;
      if (route.params.videoId) {
        router.push(`/${lang}`);
      }
    }
    else if (open && store.selectedVideo) {
      const lang = route.params.language as string;
      const lank = store.selectedVideo.languageAgnosticNaturalKey;
      if (route.params.videoId !== lank) {
        router.push(`/${lang}/${lank}`);
      }
      // Reopening the same video remounts the dialog's <video> element without
      // any media watcher firing, so the player must be re-initialized here
      nextTick(() => loadPlayer());
    }
  },
);

// New video selected — close the transcript and forget the old position
// (media reloading itself is handled inside useMediaItems)
watch(
  () => store.selectedVideo,
  video => {
    if (!video) {
      return;
    }
    store.setTranscriptDialog(false);
    resetResume();
  },
);
</script>

<style>
/* v-responsive defaults to flex: 1 0 auto; inside the fullscreen dialog's
   flex-column card it grows past its 16:9 sizer on tall mobile viewports,
   which makes the covered video look stretched. */
.player-frame {
  flex-grow: 0;
}
.player-row {
  position: relative;
  flex-grow: 0;
}
.player-row--split .player-frame {
  width: calc(100% - 340px);
}
.transcript-side {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 340px;
}
.transcript-below {
  flex-grow: 1;
  min-height: 0;
}
.plyr {
  height: 100%;
  --plyr-font-size-xlarge: 36px;
  --plyr-font-size-large: 22px;
}
.plyr__poster {
  background-size: cover !important;
}
.plyr__control--transcript[aria-pressed='true'] {
  background: var(--plyr-video-control-background-hover, var(--plyr-color-main, #00b3ff));
  color: #fff;
}
@media (max-width: 959.98px) {
  /* smAndDown — hide if a resize crossed the breakpoint after injection */
  .plyr__control--transcript {
    display: none;
  }
}

/* .player-row is Plyr's fullscreen container (desktop), so Plyr's own
   .plyr:fullscreen sizing never applies; replicate the essentials. Cover both
   native fullscreen and Plyr's class-based fallback. */
.player-row:fullscreen,
.player-row.plyr--fullscreen-fallback {
  background: #000;
}
.player-row:fullscreen .player-frame,
.player-row.plyr--fullscreen-fallback .player-frame {
  width: 100%;
  height: 100%;
  max-height: 100%;
}
.player-row:fullscreen.player-row--split .player-frame,
.player-row.plyr--fullscreen-fallback.player-row--split .player-frame {
  width: calc(100% - 340px);
}
.player-row:fullscreen .player-frame .v-responsive__sizer,
.player-row.plyr--fullscreen-fallback .player-frame .v-responsive__sizer {
  /* Inline padding-bottom from :aspect-ratio would letterbox at viewport height */
  padding-bottom: 0 !important;
}
.player-row:fullscreen .player-frame video,
.player-row.plyr--fullscreen-fallback .player-frame video {
  /* Inline object-fit: cover would crop on non-16:9 viewports */
  object-fit: contain !important;
}
.player-row:fullscreen .plyr__poster,
.player-row.plyr--fullscreen-fallback .plyr__poster {
  /* Match the video's object-fit: contain so the poster stays 16:9 */
  background-size: contain !important;
}
.player-row:fullscreen .transcript-side,
.player-row.plyr--fullscreen-fallback .transcript-side {
  /* Panel has no background of its own; without this it sits on black */
  background: rgb(var(--v-theme-surface));
}
</style>

<template>
  <v-menu location="top" transition="slide-y-reverse-transition">
    <template #activator="{ props: menuProps }">
      <v-tooltip :text="tooltipText" location="right">
        <template #activator="{ props: tooltipProps }">
          <v-btn
            color="primary"
            class="mr-2"
            prepend-icon="mdi-cast"
            :loading="!videoMedia || !subtitleMedia"
            v-bind="{ ...menuProps, ...tooltipProps }"
          >
            {{ store.translations.btnPlay }}
          </v-btn>
        </template>
      </v-tooltip>
    </template>

    <v-list density="compact" v-if="videoMedia">
      <v-list-subheader>
        {{ castAvailable ? 'Chromecast' : 'SMPlayer (Chromecast)' }}
      </v-list-subheader>
      <v-list-item
        v-for="file in filteredFiles"
        :key="file.checksum"
        :title="file.label"
        :prepend-icon="castAvailable ? 'mdi-cast' : 'mdi-open-in-new'"
        @click="onSelectFile(file)"
      />
    </v-list>
  </v-menu>
</template>

<script setup lang="ts">
import type { MediaFile, Video } from '~/types';

const props = defineProps<{
  videoMedia: Video | null;
  subtitleMedia: Video | null;
  subtitleUrl: string | null;
}>();

const store = useAppStore();
const { isAvailable: castAvailable, castMedia, getSmPlayerUrl } = useCast();

const filteredFiles = computed(
  () => props.videoMedia?.files.filter((f) => f.label !== '144p') ?? [],
);

const tooltipText = computed(() =>
  props.subtitleUrl
    ? store.translations.btnPlayWithSubtitles
    : store.translations.btnPlayWithoutSubtitles,
);

async function onSelectFile(file: MediaFile) {
  const title = store.selectedVideo?.title ?? '';

  if (castAvailable.value) {
    const ok = await castMedia(file.progressiveDownloadURL, title, props.subtitleUrl);
    if (!ok) {
      // Fall back to SMPlayer if casting failed (e.g. user dismissed the picker)
      window.open(getSmPlayerUrl(file.progressiveDownloadURL, title, props.subtitleUrl), '_blank');
    }
  } else {
    window.open(getSmPlayerUrl(file.progressiveDownloadURL, title, props.subtitleUrl), '_blank');
  }
}
</script>

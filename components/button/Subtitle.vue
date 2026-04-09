<template>
  <v-menu location="top" transition="slide-y-reverse-transition">
    <template #activator="{ props }">
      <v-btn
        color="primary"
        class="ml-2"
        prepend-icon="mdi-download"
        :loading="!subtitleMedia"
        :disabled="subtitleUrl === null"
        v-bind="props"
      >
        {{ store.translations.hdgSubtitles }}
      </v-btn>
    </template>

    <v-list density="compact" v-if="subtitleMedia">
      <v-list-item
        :href="subtitleUrl ?? undefined"
        prepend-icon="mdi-download"
        :title="store.translations.btnDownload"
      />
      <v-list-item
        prepend-icon="mdi-text"
        title="Transcript"
        @click="onOpenTranscript"
      />
    </v-list>
  </v-menu>
</template>

<script setup lang="ts">
import type { Video } from '~/types';

const props = defineProps<{
  subtitleMedia: Video | null;
  subtitleUrl: string | null;
}>();

const store = useAppStore();

function onOpenTranscript() {
  store.setSubtitleMedia(props.subtitleMedia);
  store.setTranscriptDialog(true);
}
</script>

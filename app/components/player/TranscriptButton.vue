<template>
  <v-btn
    class="ml-2"
    color="primary"
    :disabled="subtitleUrl === null"
    :loading="!subtitleMedia"
    :prepend-icon="uiStore.transcriptDialog ? 'mdi-arrow-left' : 'mdi-script-text-outline'"
    :variant="uiStore.transcriptDialog ? 'outlined' : 'elevated'"
    @click="uiStore.setTranscriptDialog(!uiStore.transcriptDialog)"
  >
    {{ languageStore.t('transcript') }}
  </v-btn>
</template>

<script setup lang="ts">
import type { Video } from '~/types';

defineProps<{
  subtitleMedia: Video | null;
  subtitleUrl: string | null;
}>();

const languageStore = useLanguageStore();
const uiStore = useUiStore();
</script>

<template>
  <v-menu location="bottom end" transition="slide-y-transition">
    <template #activator="{ props: menuProps }">
      <v-btn icon v-bind="menuProps">
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
</template>

<script setup lang="ts">
import type { Video } from '~/types';

const props = defineProps<{
  videoMedia: Video | null;
  subtitleUrl: string | null;
}>();

const store = useAppStore();

const jwOrgUrl = computed(() => {
  const video = store.selectedVideo ?? props.videoMedia;
  if (!video) {
    return null;
  }
  const { locale } = store.getSiteLanguage!;
  return `https://www.jw.org/finder?locale=${locale}&category=${video.primaryCategory}&lank=${video.languageAgnosticNaturalKey}`;
});
</script>

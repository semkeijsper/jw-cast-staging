<template>
  <v-menu location="bottom end" transition="slide-y-transition">
    <template #activator="{ props: menuProps }">
      <v-btn icon v-bind="menuProps">
        <v-icon>mdi-download</v-icon>
      </v-btn>
    </template>

    <v-list density="compact">
      <v-list-subheader>{{ languageStore.t('btnDownload') }}</v-list-subheader>

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
        :title="`${languageStore.t('hdgSubtitles')} (.vtt)`"
      />

      <v-divider class="my-1" />

      <v-list-item
        :disabled="!jwOrgUrl"
        :href="jwOrgUrl ?? undefined"
        prepend-icon="mdi-open-in-new"
        target="_blank"
        :title="languageStore.t('lnkHome')"
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

const languageStore = useLanguageStore();
const uiStore = useUiStore();

const jwOrgUrl = computed(() => {
  const video = uiStore.selectedVideo ?? props.videoMedia;
  if (!video) {
    return null;
  }
  const { locale } = languageStore.siteLanguageInfo;
  return `https://www.jw.org/finder?locale=${locale}&category=${video.primaryCategory}&lank=${video.languageAgnosticNaturalKey}`;
});
</script>

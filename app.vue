<template>
  <v-app>
    <v-app-bar elevation="2">
      <v-app-bar-title>JW Cast</v-app-bar-title>

      <template #append>
        <template v-if="store.translations.lnkSearch">
          <v-btn
            v-if="!xs"
            variant="text"
            prepend-icon="mdi-magnify"
            @click="store.setSearchDialog(true)"
          >
            {{ store.translations.lnkSearch }}
          </v-btn>
          <v-btn v-else icon @click="store.setSearchDialog(true)">
            <v-icon>mdi-magnify</v-icon>
          </v-btn>
        </template>
        <v-btn
          variant="text"
          prepend-icon="mdi-book-open-blank-variant"
          href="https://github.com/semkeijsper/jw-cast#handleiding"
          target="_blank"
        >
          <span v-if="!xs">{{ guideButtonText }}</span>
        </v-btn>
      </template>
    </v-app-bar>

    <v-main>
      <NuxtPage />
    </v-main>

    <SearchDialog />
    <VideoDialog />
    <TranscriptDialog />
  </v-app>
</template>

<script setup lang="ts">
import { useDisplay, useTheme } from 'vuetify';

const store = useAppStore();
const { xs } = useDisplay();
const { global: theme } = useTheme();
const { initCast } = useCast();

onMounted(() => {
  theme.name.value = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  initCast();

  // GitHub Pages SPA: restore path encoded by 404.html
  const search = window.location.search;
  if (search.startsWith('?p=/')) {
    const path = search.slice(3).replace(/~and~/g, '&');
    const url = path + (search.includes('&q=') ? '' : '');
    window.history.replaceState(null, '', url || '/');
  }
});

const guideButtonText = computed(() => {
  switch (store.siteLanguage) {
    case 'nl':
      return 'Handleiding';
    case 'en':
      return 'Guide';
    default:
      return store.translations.lnkHelpView ?? 'Guide';
  }
});
</script>

<style>
* {
  scrollbar-width: thin;
}

html {
  overflow-y: hidden;
}

.v-main {
  height: 100dvh;
  overflow-y: auto;
}
</style>

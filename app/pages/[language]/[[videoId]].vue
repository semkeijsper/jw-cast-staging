<template>
  <v-container>
    <v-row justify="center">
      <v-col class="mt-3" cols="12" sm="12" xl="8">
        <!-- Page title — zero-width space keeps layout stable while loading -->
        <span class="text-display-medium font-weight-bold">
          {{ store.translations.hdgVideos || '\u200D' }}
        </span>

        <v-row>
          <v-col cols="12" lg="4" sm="6" xs="12">
            <CommonLanguageSelect
              v-model="siteLanguage"
              class="mt-4"
              icon="mdi-translate"
              :items="store.languages"
            />
          </v-col>
        </v-row>

        <v-divider class="mt-8" />
      </v-col>
    </v-row>

    <v-row v-if="loadFailed" justify="center">
      <v-col cols="12" sm="12" xl="8">
        <v-alert type="error" variant="tonal">
          <div class="d-flex align-center justify-space-between flex-wrap ga-2">
            <span>{{ loadErrorMessage }}</span>

            <v-btn color="error" variant="outlined" @click="initPage(language)">
              {{ retryLabel }}
            </v-btn>
          </div>
        </v-alert>
      </v-col>
    </v-row>

    <template v-if="ready">
      <VideoCategory category-name="LatestVideos" divider grid>
        <template v-if="store.whatsappChannel" #title-actions>
          <v-btn color="primary" variant="outlined" @click="store.setGetNotifiedDialog(true)">
            <v-icon :start="!xs">mdi-bell</v-icon>
            <span class="d-none d-sm-inline">{{ store.whatsappChannel.ctaLabel }}</span>
          </v-btn>
        </template>
      </VideoCategory>

      <VideoCategory category-name="StudioMonthlyPrograms" divider :limit="12" />
      <VideoCategory category-name="StudioTalks" divider :limit="9" />
      <VideoCategory category-name="StudioNewsReports" class="mb-3" :limit="9" />
    </template>
  </v-container>
</template>

<script setup lang="ts">
import { useDisplay } from 'vuetify';

definePageMeta({
  // Keep the same component instance when only videoId changes (e.g. opening/closing a video
  // dialog). Without this, Nuxt generates different page keys for /:language and
  // /:language/:videoId, causing a full remount and visible grid flicker on every dialog open.
  key: route => route.params.language as string,
});

const store = useAppStore();
const route = useRoute();
const router = useRouter();
const { xs } = useDisplay();

const ready = ref(false);
const loadFailed = ref(false);

const loadErrorMessage = computed(() => {
  switch (store.siteLanguage) {
    case 'nl': {
      return 'Laden is mislukt. Probeer het later opnieuw.';
    }
    default: {
      return 'Loading failed. Please try again later.';
    }
  }
});

const retryLabel = computed(() => {
  switch (store.siteLanguage) {
    case 'nl': {
      return 'Opnieuw proberen';
    }
    default: {
      return 'Retry';
    }
  }
});

const language = computed(() => route.params.language as string);
const videoId = computed(() => route.params.videoId as string | undefined);

// Two-way binding for the language autocomplete
const siteLanguage = computed({
  get: () => store.getSiteLanguage?.locale ?? 'nl',
  set: (value: string) => {
    if (!value) {
      return;
    }
    store.setSiteLanguage(value);
    router.push(`/${value}`);
  },
});

async function loadLanguages() {
  const known = store.languages.some(l => l.locale === store.siteLanguage);
  const languages = await fetchLanguages(known ? store.getSiteLanguage!.code : '-');

  // Pin Dutch and English at the top
  const nl = languages.find(l => l.locale === 'nl');
  const en = languages.find(l => l.locale === 'en');
  const rest = languages.filter(l => l.locale !== 'nl' && l.locale !== 'en');
  if (nl) {
    rest.unshift(nl);
  }
  if (en) {
    rest.splice(nl ? 1 : 0, 0, en);
  }

  store.setLanguages(rest);
}

async function loadTranslations() {
  const translations = await fetchTranslations(store.getSiteLanguage!.code);
  if (translations) {
    store.setTranslations(translations);
  }
}

async function openVideoFromUrl(lank: string) {
  try {
    const video = await fetchMediaItem(store.getSiteLanguage?.code ?? 'E', lank);
    if (video) {
      store.openVideo(video);
    }
  }
  catch {
    // Invalid lank — silently ignore, don't crash the page
  }
}

async function initPage(locale: string) {
  loadFailed.value = false;
  // The seeded list only contains nl/en; unknown locales need the full list
  // before they can be validated
  if (!store.languages.some(l => l.locale === locale)) {
    try {
      await loadLanguages();
    }
    catch {
      loadFailed.value = true;
      return;
    }
    if (!store.languages.some(l => l.locale === locale)) {
      router.replace('/en');
      return;
    }
  }
  store.setSiteLanguage(locale);
  // Refetch so language names and translations are localized to the new language
  const results = await Promise.allSettled([loadLanguages(), loadTranslations()]);
  if (results.some(r => r.status === 'rejected')) {
    loadFailed.value = true;
    return;
  }

  if (videoId.value && !ready.value) {
    await openVideoFromUrl(videoId.value);
  }

  ready.value = true;
}

// Runs on mount and whenever the route language changes
watch(language, locale => initPage(locale), { immediate: true });

// Dialog open/close ↔ /:language/:videoId URL sync
useVideoRoute();
</script>

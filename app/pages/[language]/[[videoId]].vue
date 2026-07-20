<template>
  <v-container>
    <PageSection class="mt-3">
      <!-- Page title — zero-width space keeps layout stable while loading -->
      <span class="text-display-medium font-weight-bold">
        {{ languageStore.translations.hdgVideos || '\u200D' }}
      </span>

      <v-row>
        <v-col cols="12" lg="4" sm="6" xs="12">
          <LanguageSelect
            v-model="siteLanguage"
            class="mt-4"
            icon="mdi-translate"
            :items="languageStore.languages"
          />
        </v-col>
      </v-row>

      <v-divider class="mt-8" />
    </PageSection>

    <PageSection v-if="loadFailed">
      <v-alert type="error" variant="tonal">
        <div class="d-flex align-center justify-space-between flex-wrap ga-2">
          <span>{{ languageStore.t('loadFailed') }}</span>

          <v-btn color="error" variant="outlined" @click="initPage(language)">
            {{ languageStore.t('retry') }}
          </v-btn>
        </div>
      </v-alert>
    </PageSection>

    <template v-if="ready">
      <VideoCategory category-name="LatestVideos" divider grid>
        <template v-if="languageStore.whatsappChannel" #title-actions>
          <v-btn color="primary" variant="outlined" @click="uiStore.setGetNotifiedDialog(true)">
            <v-icon :start="!xs">mdi-bell</v-icon>
            <span class="d-none d-sm-inline">{{ languageStore.whatsappChannel.ctaLabel }}</span>
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

const languageStore = useLanguageStore();
const uiStore = useUiStore();
const route = useRoute();
const router = useRouter();
const { xs } = useDisplay();

const ready = ref(false);
const loadFailed = ref(false);

const language = computed(() => route.params.language as string);
const videoId = computed(() => route.params.videoId as string | undefined);

// Two-way binding for the language autocomplete
const siteLanguage = computed({
  get: () => languageStore.siteLanguageInfo.locale,
  set: (value: string) => {
    if (!value) {
      return;
    }
    languageStore.setSiteLanguage(value);
    router.push(`/${value}`);
  },
});

async function loadLanguages() {
  const known = languageStore.languages.some(l => l.locale === languageStore.siteLanguage);
  const languages = await fetchLanguages(known ? languageStore.siteLanguageInfo.code : '-');

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

  languageStore.setLanguages(rest);
}

async function loadTranslations() {
  const translations = await fetchTranslations(languageStore.siteLanguageInfo.code);
  if (translations) {
    languageStore.setTranslations(translations);
  }
}

async function openVideoFromUrl(lank: string) {
  try {
    const video = await fetchMediaItem(languageStore.siteLanguageInfo.code, lank);
    if (video) {
      uiStore.openVideo(video);
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
  if (!languageStore.languages.some(l => l.locale === locale)) {
    try {
      await loadLanguages();
    }
    catch {
      loadFailed.value = true;
      return;
    }
    if (!languageStore.languages.some(l => l.locale === locale)) {
      router.replace('/en');
      return;
    }
  }
  languageStore.setSiteLanguage(locale);
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

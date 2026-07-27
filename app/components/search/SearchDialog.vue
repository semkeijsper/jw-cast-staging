<template>
  <v-dialog
    v-model="dialog"
    :fullscreen="smAndDown"
    max-width="1100px"
    scrollable
    transition="dialog-bottom-transition"
  >
    <v-card class="d-flex flex-column">
      <v-toolbar class="flex-grow-0" color="primary">
        <!-- Search input -->
        <v-text-field
          v-model="query"
          autocomplete="off"
          autofocus
          class="search-input ml-4 mr-1"
          clearable
          density="compact"
          hide-details
          :placeholder="languageStore.t('searchPlaceholder')"
          prepend-inner-icon="mdi-magnify"
          single-line
          variant="outlined"
        />

        <template #append>
          <v-btn icon @click="dialog = false">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </template>
      </v-toolbar>

      <!-- Fixed header: result count + sort (visible from open, stays while results scroll) -->
      <v-row
        v-if="!hasError && (!response || results.length > 0)"
        align="center"
        class="sort-bar flex-grow-0 ga-2 ga-sm-0 px-4 py-2"
        no-gutters
      >
        <v-col class="py-1 pt-2" cols="12" sm="6">
          <span v-if="results.length > 0" class="text-body-2 text-medium-emphasis">{{ resultCount }}</span>

          <v-skeleton-loader
            v-else-if="isLoading || !response"
            class="count-skeleton pt-1 pb-2"
            :loading="isLoading"
            type="text"
            :width="smAndDown ? undefined : 160"
          />
        </v-col>

        <v-col class="d-flex justify-sm-end" cols="12" sm="6">
          <v-select
            v-model="sort"
            class="sort-select flex-grow-0"
            density="compact"
            hide-details
            item-title="label"
            item-value="key"
            :items="sortItems"
            :list-props="{ density: 'compact' }"
            prepend-icon="mdi-sort"
            variant="outlined"
          />
        </v-col>
      </v-row>

      <v-card-text class="results-scroll pa-4">
        <!-- Search error -->
        <v-alert v-if="hasError" class="mb-4" type="error" variant="tonal">
          {{ languageStore.t('searchFailed') }}
        </v-alert>

        <!-- No results -->
        <div v-else-if="response && results.length === 0 && !isLoading">
          <span class="text-body-medium text-medium-emphasis">
            {{ response.messages[0]?.message ?? languageStore.t('noSearchResultsText') }}
          </span>

          <div
            v-if="response.messages[1]"
            class="mt-1 text-body-medium text-medium-emphasis search-message"
            v-html="response.messages[1].message"
          />

          <div v-else class="mt-1 text-body-medium text-medium-emphasis">
            {{ languageStore.t('refineSearchResultsText') }}
          </div>
        </div>

        <!-- Results grid -->
        <v-row v-else-if="results.length > 0">
          <v-col
            v-for="result in results"
            :key="result.lank"
            cols="12"
            lg="4"
            sm="6"
          >
            <VideoCard
              :src="result.image.url"
              :title="result.title"
              @click="onClickResult(result)"
            />
          </v-col>
        </v-row>

        <!-- Skeleton grid while loading -->
        <v-row v-else-if="!response">
          <v-col
            v-for="i in 3"
            :key="i"
            cols="12"
            lg="4"
            sm="6"
          >
            <v-skeleton-loader boilerplate class="skeleton-card" :loading="isLoading" type="image" />
          </v-col>
        </v-row>

        <!-- Infinite-scroll sentinel + loading indicator -->
        <div
          v-if="!hasError && results.length > 0"
          v-intersect="{ handler: onIntersect, options: { rootMargin: '0px' } }"
          class="scroll-sentinel d-flex justify-center py-4"
        >
          <v-progress-circular v-if="isLoadingMore" color="primary" indeterminate size="28" />
        </div>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import type { SearchResponse, SearchResult } from '~/types/search';
import { FetchError } from 'ofetch';
import { useDisplay } from 'vuetify';

const languageStore = useLanguageStore();
const uiStore = useUiStore();
const { smAndDown } = useDisplay();

const LIMIT = 12;
const DEBOUNCE_MS = 400;

const jwt = ref('');
const sort = ref('rel');
const sortKeys = ['rel', 'newest', 'oldest'];
const isLoading = ref(false);
const isLoadingMore = ref(false);
const hasError = ref(false);
const searchQuery = ref('');
const response = ref<SearchResponse | null>(null);
const results = ref<SearchResult[]>([]);
const offset = ref(0);
const exhausted = ref(false);

const dialog = computed({
  get: () => uiStore.searchDialog,
  set: v => uiStore.setSearchDialog(v),
});

// Debounced query setter
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

const query = computed({
  get: () => searchQuery.value,
  set: (value: string) => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      offset.value = 0;
      searchQuery.value = value;
    }, DEBOUNCE_MS);
  },
});

// jw.org translation strings use Java-style positional placeholders (%1$s, %2$s)
function fmt(key: string, ...args: (string | number)[]) {
  return languageStore.t(key).replace(/%(\d+)\$s/g, (_, i) => String(args[Number(i) - 1] ?? ''));
}

const resultCount = computed(() =>
  fmt('searchResultsCountText', results.value.length, response.value?.insight.total.value ?? 0),
);

const sortLabelKeys: Record<string, string> = {
  rel: 'sortRelevance',
  newest: 'sortNewest',
  oldest: 'sortOldest',
};

const sortItems = computed(() =>
  sortKeys.map(key => ({
    key,
    label: response.value?.sorts.find(s => sortKeyOf(s.link) === key)?.label
      ?? languageStore.t(sortLabelKeys[key]!),
  })),
);

// The server total counts videoCategory rows we filter out, so results.length
// alone never reaches it — the raw page size is the real end-of-list signal
const hasMore = computed(
  () => !exhausted.value && results.value.length < (response.value?.insight.total.value ?? 0),
);

function onIntersect(isIntersecting: boolean) {
  if (!isIntersecting || !hasMore.value || isLoading.value || isLoadingMore.value) {
    return;
  }
  offset.value += LIMIT;
  fetchResponse(searchQuery.value, { append: true });
}

async function loadToken() {
  jwt.value = await fetchToken();
}

async function fetchVideo(langCode: string | undefined, lank: string | undefined) {
  if (!langCode || !lank) {
    hasError.value = true;
    return;
  }
  try {
    const video = await fetchMediaItem(langCode, lank);
    if (!video) {
      hasError.value = true;
      return;
    }
    uiStore.openVideo(video);
  }
  catch {
    hasError.value = true;
  }
}

// Guards against a slow earlier response overwriting a newer one
// (page/sort changes bypass the debounce and can race)
let requestId = 0;

async function fetchResponse(query: string, { append = false, retried = false } = {}) {
  const id = retried ? requestId : ++requestId;
  if (append) {
    isLoadingMore.value = true;
  }
  else {
    isLoading.value = true;
    exhausted.value = false;
  }
  hasError.value = false;
  try {
    const data = await fetchSearch(
      languageStore.siteLanguageInfo.code,
      query,
      { sort: sort.value, offset: offset.value, limit: LIMIT },
      jwt.value,
    );
    if (id !== requestId) {
      return;
    }
    if (data.results.length < LIMIT) {
      exhausted.value = true;
    }
    // Filter out category results — only show individual videos
    data.results = data.results.filter(r => r.subtype !== 'videoCategory');
    response.value = data;
    results.value = append ? [...results.value, ...data.results] : data.results;
  }
  catch (error) {
    if (id !== requestId) {
      return;
    }
    if (!retried && error instanceof FetchError && error.response?.status === 401) {
      try {
        await loadToken();
        await fetchResponse(query, { append, retried: true });
      }
      catch {
        hasError.value = true;
      }
    }
    else {
      hasError.value = true;
    }
  }
  finally {
    if (id === requestId) {
      isLoading.value = false;
      isLoadingMore.value = false;
    }
  }
}

function onClickResult(result: SearchResult) {
  fetchVideo(languageStore.siteLanguageInfo.code, result.lank);
}

watch(searchQuery, async value => {
  if (!value) {
    response.value = null;
    results.value = [];
    hasError.value = false;
    exhausted.value = false;
    return;
  }

  // Pasted jw.org finder / media-items link → open that video directly
  const parsed = parseVideoLink(value);
  if (parsed.kind === 'finder' || parsed.kind === 'mediaitems') {
    const lang = 'wtlocale' in parsed && parsed.wtlocale
      ? parsed.wtlocale
      : languageStore.findLanguageByLocale(parsed.locale)?.code;
    await fetchVideo(lang, parsed.lank);
    // Keep the query (and the error alert) when the link failed to resolve
    if (!hasError.value) {
      searchQuery.value = '';
    }
    return;
  }

  fetchResponse(value);
});

watch(sort, () => {
  offset.value = 0;
  if (searchQuery.value) {
    fetchResponse(searchQuery.value);
  }
});

watch(
  () => languageStore.siteLanguageInfo,
  () => {
    searchQuery.value = '';
    response.value = null;
    results.value = [];
    hasError.value = false;
    exhausted.value = false;
  },
);

// Fetch the JWT lazily on first open instead of on app start; the 401
// retry in fetchResponse covers expiry
watch(
  () => uiStore.searchDialog,
  open => {
    if (open && !jwt.value) {
      loadToken().catch(() => {});
    }
  },
);
</script>

<style scoped>
.results-scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
}
/* Desktop (non-fullscreen dialog): cap height below one page of results so the
   first page overflows and the sentinel stays below the fold — no auto-load of
   page 2 until the user actually scrolls. */
@media (min-width: 960px) {
  .results-scroll {
    max-height: min(70vh, 600px);
  }
}
/* Reserve the spinner's height so toggling it never resizes the sentinel —
   a resize re-fires the IntersectionObserver and can loop the fetch */
.scroll-sentinel {
  min-height: 28px;
}
.sort-bar {
  border-bottom: thin solid rgba(var(--v-theme-on-surface), 0.12);
}
.sort-select {
  width: 220px;
}
/* Stacked on xs — the select takes the full row instead of a fixed column */
@media (max-width: 599.98px) {
  .sort-select {
    width: 100%;
  }
}
.count-skeleton :deep(.v-skeleton-loader__bone) {
  margin: 0;
}
.search-message :deep(ul) {
  margin-block: 8px;
  padding-inline-start: 24px;
  list-style: disc;
}
.skeleton-card {
  aspect-ratio: 2 / 1;
}
.skeleton-card :deep(.v-skeleton-loader__image) {
  height: 100%;
}
</style>

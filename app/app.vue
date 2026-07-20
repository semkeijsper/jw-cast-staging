<template>
  <v-app>
    <v-app-bar color="primary" elevation="2" :height="xs ? 56 : 64">
      <v-app-bar-title>JW Cast</v-app-bar-title>

      <template #append>
        <template v-if="store.translations.lnkSearch">
          <v-btn
            v-if="!xs"
            prepend-icon="mdi-magnify"
            variant="text"
            @click="store.setSearchDialog(true)"
          >
            {{ store.t('lnkSearch') }}
          </v-btn>

          <v-btn v-else icon @click="store.setSearchDialog(true)">
            <v-icon>mdi-magnify</v-icon>
          </v-btn>
        </template>

        <v-btn
          href="https://github.com/semkeijsper/jw-cast#handleiding"
          prepend-icon="mdi-book-open-blank-variant"
          target="_blank"
          variant="text"
        >
          <span v-if="!xs">{{ guideButtonText }}</span>
        </v-btn>
      </template>
    </v-app-bar>

    <v-main>
      <NuxtPage />
    </v-main>

    <CastBar />

    <SearchDialog />
    <VideoDialog />
    <GetNotifiedDialog />
  </v-app>
</template>

<script setup lang="ts">
import { useDisplay, useTheme } from 'vuetify';
import { uiStrings } from '~/config/uiStrings';

const store = useAppStore();
const { xs } = useDisplay();
const { global: theme } = useTheme();
const { initCast } = useCast();

onMounted(() => {
  theme.name.value = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  initCast();
});

// Local dict first for nl/en (jw.org's lnkHelpView is a different phrase),
// API translation for other locales, English as the last resort
const guideButtonText = computed(
  () => uiStrings[store.siteLanguage]?.guide ?? store.translations.lnkHelpView ?? uiStrings.en!.guide!,
);
</script>

<style>
@layer vuetify-core.reset {
  ul, ol, figure, details, summary {
    padding: 0;
    margin: 0;
  }

  h1, h2, h3, h4, h5, h6, p {
    margin: 0;
  }
}

@layer vuetify-core.reset {
  * {
    padding: 0;
    margin: 0;
  }
  a:active,
  a:hover {
    outline-width: 0;
  }
  code,
  kbd,
  pre,
  samp {
    font-family: monospace;
  }
  pre {
    font-size: 1em;
  }
  small {
    font-size: 80%;
  }
  sub,
  sup {
    font-size: 75%;
    line-height: 0;
    position: relative;
    vertical-align: baseline;
  }
  sub {
    bottom: -0.25em;
  }
  sup {
    top: -0.5em;
  }
  textarea {
    resize: vertical;
  }
  button,
  input,
  select,
  textarea {
    background-color: transparent;
    border-style: none;
  }
  select {
    -moz-appearance: none;
    -webkit-appearance: none;
  }
  legend {
    display: table;
    max-width: 100%;
    white-space: normal;
  }
}

* {
  scrollbar-width: thin;
}

html {
  overflow-y: hidden;
  /* Plain font-family declaration so @nuxt/fonts detects and self-hosts Roboto;
     Vuetify only references it inside a var() fallback, which the scanner can't see. */
  font-family: 'Roboto', sans-serif;
}

.v-main {
  height: 100dvh;
  overflow-y: auto;
}

/* Vuetify 2's dense lists also used a smaller title font;
   Vuetify 3's compact density only reduces heights */
.v-list--density-compact .v-list-item-title {
  font-size: 0.8125rem;
}
</style>

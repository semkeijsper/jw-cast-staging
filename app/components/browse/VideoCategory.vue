<template>
  <v-row v-if="category" justify="center">
    <v-col cols="12" sm="12" xl="8">
      <div v-if="!hideTitle" class="d-flex align-center justify-space-between mb-6">
        <span class="text-headline-large font-weight-medium">{{ category.name }}</span>
        <slot name="title-actions" />
      </div>

      <VideoGrid v-if="grid" :videos="media" />
      <VideoSwiper v-else :videos="media" />
      <v-divider v-if="divider" :class="grid ? 'mt-8' : 'mt-5'" />
    </v-col>
  </v-row>
</template>

<script setup lang="ts">
import type { Category, Video } from '~/types';

const props = defineProps<{
  categoryName: string;
  grid?: boolean;
  hideTitle?: boolean;
  divider?: boolean;
  limit?: number;
  filter?: RegExp;
}>();

const languageStore = useLanguageStore();
const category = ref<Category | null>(null);

const media = computed<Video[]>(() => {
  if (!category.value?.media) {
    return [];
  }
  if (!props.filter) {
    return category.value.media;
  }
  return category.value.media.filter(m => props.filter!.test(m.languageAgnosticNaturalKey));
});

async function loadCategory() {
  try {
    category.value = await fetchCategory(languageStore.siteLanguageInfo.code, props.categoryName, props.limit);
  }
  catch {
    category.value = null;
  }
}

watch(
  () => languageStore.siteLanguageInfo,
  (newLang, oldLang) => {
    if (newLang?.locale !== oldLang?.locale) {
      loadCategory();
    }
  },
);

onMounted(loadCategory);
</script>

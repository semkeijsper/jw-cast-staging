<template>
  <v-autocomplete
    v-model="model"
    density="compact"
    hide-details
    :item-title="languageLabel"
    item-value="locale"
    :items="items"
    :list-props="{ density: 'compact' }"
    :prepend-icon="icon"
    variant="outlined"
  />
</template>

<script setup lang="ts">
import type { Language } from '~/types';

defineProps<{
  items: Language[];
  icon: string;
}>();

const model = defineModel<string>({ required: true });
</script>

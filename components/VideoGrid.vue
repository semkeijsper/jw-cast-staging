<template>
  <v-row>
    <v-col v-for="video in videos" :key="video.guid" sm="6" lg="4" cols="12">
      <v-card rounded class="video-card" @click="onClickVideo(video)">
        <v-img :src="video.images.lss.lg" :aspect-ratio="2 / 1" cover>
          <div class="image-overlay d-flex align-end">
            <v-card-title class="text-white" style="word-break: normal; user-select: none;">
              {{ video.title }}
            </v-card-title>
          </div>
        </v-img>
      </v-card>
    </v-col>
  </v-row>
</template>

<script setup lang="ts">
import type { Video } from '~/types';

defineProps<{ videos: Video[] }>();

const store = useAppStore();
const route = useRoute();
const router = useRouter();

function onClickVideo(video: Video) {
  store.setSelectedVideo(video);
  store.setVideoDialog(true);
  router.push(`/${route.params.language}/${video.languageAgnosticNaturalKey}`);
}
</script>

<style scoped>
.video-card {
  cursor: pointer;
  transition: box-shadow 0.2s;
}
.video-card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3) !important;
}
.image-overlay {
  background: linear-gradient(to bottom, rgba(0, 0, 0, 0.1), rgba(0, 0, 0, 0.55));
  height: 100%;
}
</style>

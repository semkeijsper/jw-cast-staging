import type { Video } from '~/types';

export const useUiStore = defineStore('ui', () => {
  const searchDialog = ref(false);
  const videoDialog = ref(false);
  const transcriptDialog = ref(false);
  const getNotifiedDialog = ref(false);
  const selectedVideo = ref<Video | null>(null);

  // Mutations
  function setSearchDialog(value: boolean) {
    searchDialog.value = value;
  }
  function setVideoDialog(value: boolean) {
    videoDialog.value = value;
  }
  function setTranscriptDialog(value: boolean) {
    transcriptDialog.value = value;
  }
  function setGetNotifiedDialog(value: boolean) {
    getNotifiedDialog.value = value;
  }
  function setSelectedVideo(value: Video | null) {
    selectedVideo.value = value;
  }

  // Select a video and open the player dialog — the single entry point for
  // every open path (grid, swiper, search result, pasted link, direct URL)
  function openVideo(video: Video) {
    selectedVideo.value = video;
    videoDialog.value = true;
  }

  return {
    searchDialog,
    videoDialog,
    transcriptDialog,
    getNotifiedDialog,
    selectedVideo,
    setSearchDialog,
    setVideoDialog,
    setTranscriptDialog,
    setGetNotifiedDialog,
    setSelectedVideo,
    openVideo,
  };
});

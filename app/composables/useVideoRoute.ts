/**
 * Single owner of the /:language/:videoId URL sync. Called once from the
 * language page: pushes the video's lank into the URL when the dialog opens,
 * pops it when the dialog closes, and closes the dialog when the videoId
 * segment disappears (e.g. browser back).
 */
export function useVideoRoute() {
  const uiStore = useUiStore();
  const route = useRoute();
  const router = useRouter();

  // Dialog state → URL
  watch(
    () => uiStore.videoDialog,
    open => {
      const lang = route.params.language as string;
      if (!open) {
        if (route.params.videoId) {
          router.push(`/${lang}`);
        }
      }
      else if (uiStore.selectedVideo) {
        const lank = uiStore.selectedVideo.languageAgnosticNaturalKey;
        if (route.params.videoId !== lank) {
          router.push(`/${lang}/${lank}`);
        }
      }
    },
  );

  // URL → dialog state (browser back removes the videoId segment)
  watch(
    () => route.params.videoId,
    id => {
      if (!id && uiStore.videoDialog) {
        uiStore.setVideoDialog(false);
        uiStore.setSelectedVideo(null);
      }
    },
  );
}

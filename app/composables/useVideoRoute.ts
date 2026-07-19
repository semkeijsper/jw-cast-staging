/**
 * Single owner of the /:language/:videoId URL sync. Called once from the
 * language page: pushes the video's lank into the URL when the dialog opens,
 * pops it when the dialog closes, and closes the dialog when the videoId
 * segment disappears (e.g. browser back).
 */
export function useVideoRoute() {
  const store = useAppStore();
  const route = useRoute();
  const router = useRouter();

  // Dialog state → URL
  watch(
    () => store.videoDialog,
    open => {
      const lang = route.params.language as string;
      if (!open) {
        if (route.params.videoId) {
          router.push(`/${lang}`);
        }
      }
      else if (store.selectedVideo) {
        const lank = store.selectedVideo.languageAgnosticNaturalKey;
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
      if (!id && store.videoDialog) {
        store.setVideoDialog(false);
        store.setSelectedVideo(null);
      }
    },
  );
}

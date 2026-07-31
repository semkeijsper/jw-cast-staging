import type { Video } from '~/types';
import type {
  CastSession,
  CastWindow,
  MediaSession,
  RemotePlayer,
  RemotePlayerController,
} from '~/types/cast';

/**
 * Google Cast Web Sender SDK composable.
 *
 * The Cast SDK is loaded via the <script> tag in nuxt.config.ts. Readiness is
 * polled rather than taken from window.__onGCastApiAvailable — that global
 * belongs to cast_sender.js, which captures it once and then replaces it with
 * its own counter (see initCast). We use the Default Media Receiver
 * (CC1AD845) — no app registration required.
 *
 * Falls back gracefully when no Chromecast is available.
 */

// Shared across all component instances
const isAvailable = ref(false);
const isMediaLoaded = ref(false);
const isMuted = ref(false);
const volumeLevel = ref(1);
const currentTime = ref(0);
const duration = ref(0);
const canSeek = ref(false);
const canPause = ref(false);
const castDeviceName = ref('');
const castTitle = ref('');
const hasCaptions = ref(false);
const captionsEnabled = ref(false);
// True from device selection until media is loaded on the receiver
const isConnecting = ref(false);
// True while the device picker is open (requestSession pending). Drives only
// the CastButton's loading state — no session exists yet, so nothing else
const isAwaitingDevice = ref(false);
// Last cast failure (a chrome.cast.ErrorCode), surfaced by CastErrorSnackbar.
// A cancelled device picker is not a failure and never lands here.
const castError = ref<string | null>(null);

let remotePlayer: RemotePlayer | null = null;
let remotePlayerController: RemotePlayerController | null = null;
// Start position for the media currently being loaded (local → cast handoff)
let pendingStartTime = 0;
// Video awaiting a device pick — the connecting state is entered only once a
// device is chosen (SESSION_STARTING), not while the picker is still open
let pendingCastVideo: Video | null = null;
// Resolvers waiting for a usable CastSession. requestSession() settles as soon
// as the session is *starting*, so getCurrentSession() is routinely still null
// when it returns — these are settled from the SESSION_STATE_CHANGED handler.
let sessionWaiters: ((session: CastSession | null) => void)[] = [];
// How long to keep waiting for the Cast SDK globals before giving up
const CAST_API_TIMEOUT_MS = 20_000;
// How long a rejoined session gets to attach its media session before the
// breadcrumb is treated as stale (cast ended while the page was away)
const RESUME_ADOPT_TIMEOUT_MS = 10_000;
let resumeAdoptPoll: ReturnType<typeof setInterval> | null = null;
// The receiver's media channel — a GET_STATUS here makes it broadcast the
// MEDIA_STATUS that fills the session's media list
const MEDIA_NAMESPACE = 'urn:x-cast:com.google.cast.media';
// The single text track we ever attach, referenced again by toggleCaptions
const SUBTITLE_TRACK_ID = 1;
let mediaRequestId = 0;
// Configuration must run exactly once. The readiness poll retries on failure,
// and re-running it would stack a second set of listeners on the singleton
// CastContext — every session event would then be handled twice.
let castConfigured = false;

function castWindow() {
  return window as unknown as CastWindow;
}

/** Assemble the SDK's LoadRequest for an MP4 with optional VTT subtitles. */
function buildLoadRequest(videoUrl: string, title: string, subtitleUrl?: string | null) {
  const { media } = castWindow().chrome!.cast;

  const mediaInfo = new media.MediaInfo(videoUrl, 'video/mp4');
  const metadata = new media.GenericMediaMetadata();
  metadata.title = title;
  mediaInfo.metadata = metadata;

  // Without an explicit style the Default Media Receiver renders subtitles in
  // a monospaced font on some devices
  const textTrackStyle = new media.TextTrackStyle();
  textTrackStyle.fontGenericFamily = media.TextTrackFontGenericFamily.SANS_SERIF;
  textTrackStyle.fontScale = 1;
  textTrackStyle.foregroundColor = '#FFFFFFFF';
  textTrackStyle.backgroundColor = '#00000000';
  textTrackStyle.edgeType = media.TextTrackEdgeType.OUTLINE;
  textTrackStyle.edgeColor = '#000000FF';
  mediaInfo.textTrackStyle = textTrackStyle;

  if (subtitleUrl) {
    const track = new media.Track(SUBTITLE_TRACK_ID, media.TrackType.TEXT);
    track.trackContentId = subtitleUrl;
    track.trackContentType = 'text/vtt';
    track.subtype = media.TextTrackType.SUBTITLES;
    track.name = 'Subtitles';
    mediaInfo.tracks = [track];
  }

  const request = new media.LoadRequest(mediaInfo);
  if (subtitleUrl) {
    request.activeTrackIds = [SUBTITLE_TRACK_ID];
  }
  return request;
}

function settleSessionWaiters(session: CastSession | null) {
  const waiters = sessionWaiters;
  sessionWaiters = [];
  for (const settle of waiters) {
    settle(session);
  }
}

export function useCast() {
  const playback = usePlaybackStore();

  function syncRemotePlayer() {
    if (!remotePlayer) {
      return;
    }
    // When switching videos the old media stays loaded for a moment, so only
    // a false → true transition marks the *new* media as loaded and ends the
    // connecting state
    const mediaJustLoaded = !isMediaLoaded.value && remotePlayer.isMediaLoaded;
    isMediaLoaded.value = remotePlayer.isMediaLoaded;
    isMuted.value = remotePlayer.isMuted;
    volumeLevel.value = remotePlayer.volumeLevel;
    currentTime.value = remotePlayer.currentTime;
    duration.value = remotePlayer.duration;
    canSeek.value = remotePlayer.canSeek;
    canPause.value = remotePlayer.canPause;
    // While connecting, the receiver still reports the previous media's title
    // (or none at all) — keep the locally set title of the media being loaded
    // until the new media has actually landed
    if (!isConnecting.value || mediaJustLoaded) {
      castDeviceName.value = remotePlayer.displayName || castDeviceName.value;
      castTitle.value = remotePlayer.title || castTitle.value;
    }
    if (mediaJustLoaded) {
      isConnecting.value = false;
      // Handoff from local playback: LoadRequest.currentTime is ignored by
      // some receivers, so seek explicitly once the media has landed
      if (pendingStartTime > 0) {
        if (Math.abs(remotePlayer.currentTime - pendingStartTime) > 2) {
          remotePlayer.currentTime = pendingStartTime;
          remotePlayerController?.seek();
        }
        pendingStartTime = 0;
      }
    }

    // Mirror the receiver into the playback store's cast slice. The connecting
    // video (set in castMedia) carries through to the active state as identity.
    if (playback.cast.kind !== 'idle' && remotePlayer.isMediaLoaded) {
      playback.setCastActive({
        videoKey: playback.cast.videoKey,
        position: remotePlayer.currentTime,
        duration: remotePlayer.duration,
        paused: remotePlayer.isPaused,
      });
    }
    // While connecting (device picker open, or media still loading) a
    // disconnected RemotePlayer is expected — the "waiting for device" window.
    // Only a drop after we were actually connected should idle the cast slice.
    if (!isConnecting.value && !remotePlayer.isConnected && playback.cast.kind !== 'idle') {
      playback.castIdle();
    }
  }

  /**
   * Re-adopt a session the SDK auto-rejoined after a page reload.
   *
   * The receiver keeps playing across the reload, but the store's cast slice
   * starts idle — without this the CastBar never comes back and a dialog opened
   * on the cast video would build a local player on top of the running cast.
   * `castTargetKey` is the only thing that survives; everything else has to come
   * back off the receiver.
   *
   * Getting it *from* the receiver is the hard part. `getMediaSession()` only
   * scans the session's media list, which is filled from MEDIA_STATUS messages,
   * and the Default Media Receiver broadcasts those on state changes only — so
   * after a reload nothing ever arrives and the list stays empty for good.
   * (`RemotePlayer.isMediaLoaded` is dead for the same reason: the framework
   * derives it from that same status.) The sender has to ask, hence GET_STATUS.
   */
  function restoreResumedSession() {
    const videoKey = playback.castTargetKey;
    if (!videoKey || playback.cast.kind !== 'idle' || resumeAdoptPoll !== null) {
      return;
    }
    const w = castWindow();
    const context = w.cast!.framework.CastContext.getInstance();
    const session = context.getCurrentSession();
    castLog('restoreResumedSession', { videoKey, hasSession: !!session });
    if (!session) {
      return;
    }

    playback.setCastConnecting(videoKey, playback.lastCastPosition);
    // The rejoined media is already playing — there is no handoff seek pending
    pendingStartTime = 0;

    const startedAt = Date.now();
    const mediaSessionEvent = w.cast!.framework.SessionEventType.MEDIA_SESSION;
    let settled = false;

    const finish = () => {
      settled = true;
      session.removeEventListener(mediaSessionEvent, onMediaSession);
      if (resumeAdoptPoll) {
        clearInterval(resumeAdoptPoll);
        resumeAdoptPoll = null;
      }
    };

    // The media session is richer, but once any status has landed the
    // RemotePlayer carries the same values — either source is enough
    const promote = (mediaSession: MediaSession | null) => {
      if (mediaSession) {
        hasCaptions.value = (mediaSession.media?.tracks ?? []).length > 0;
        captionsEnabled.value = (mediaSession.activeTrackIds ?? []).length > 0;
      }
      isMediaLoaded.value = true;
      castDeviceName.value = remotePlayer?.displayName || castDeviceName.value;
      castTitle.value = remotePlayer?.title || mediaSession?.media?.metadata?.title || castTitle.value;
      playback.setCastActive({
        videoKey,
        position: mediaSession?.getEstimatedTime?.() ?? remotePlayer?.currentTime ?? 0,
        duration: mediaSession?.media?.duration ?? remotePlayer?.duration ?? 0,
        paused: mediaSession ? mediaSession.playerState === 'PAUSED' : !!remotePlayer?.isPaused,
      });
    };

    const adopt = (): boolean => {
      if (settled) {
        return true;
      }
      const mediaSession = context.getCurrentSession()?.getMediaSession() ?? null;
      castLog('adopt', {
        mediaSession: !!mediaSession,
        legacyMedia: session.getSessionObj?.()?.media?.length ?? null,
        isConnected: remotePlayer?.isConnected,
        isMediaLoaded: remotePlayer?.isMediaLoaded,
        currentTime: remotePlayer?.currentTime,
        duration: remotePlayer?.duration,
      });

      if (!mediaSession && !remotePlayer?.isMediaLoaded) {
        // No media on the receiver — the cast ended while this page was away,
        // so the persisted key is stale and the bar must not sit there loading
        if (Date.now() - startedAt > RESUME_ADOPT_TIMEOUT_MS) {
          castLog('adopt timed out — treating the stored cast target as stale');
          finish();
          playback.castIdle();
          return true;
        }
        return false;
      }

      promote(mediaSession);
      castLog('adopted the resumed session');
      finish();
      return true;
    };

    function onMediaSession() {
      castLog('MEDIA_SESSION event');
      adopt();
    }

    // Make the receiver broadcast its media status, which fills the session's
    // media list and fires both MEDIA_SESSION and the RemotePlayer's own sync
    const requestStatus = () => {
      if (settled) {
        return;
      }
      session.sendMessage(MEDIA_NAMESPACE, { type: 'GET_STATUS', requestId: ++mediaRequestId })
        .then(() => castLog('GET_STATUS sent'))
        .catch(error => castLog('GET_STATUS failed', errorCodeOf(error)));
    };

    session.addEventListener(mediaSessionEvent, onMediaSession);
    if (adopt()) {
      return;
    }
    requestStatus();
    // A second ask, in case the first went out before the receiver's media
    // channel was joined
    setTimeout(requestStatus, 2000);

    resumeAdoptPoll = setInterval(adopt, 500);
  }

  function initCast() {
    const w = castWindow();

    const configureCast = () => {
      if (castConfigured) {
        return;
      }
      try {
        const context = w.cast!.framework.CastContext.getInstance();
        context.setOptions({
          receiverApplicationId: 'CC1AD845',
          autoJoinPolicy: w.chrome!.cast.AutoJoinPolicy.ORIGIN_SCOPED,
        });
        // Casting is possible from here on, and this is the only step worth
        // retrying — latch so a later failure cannot re-enter and duplicate
        // the listeners below
        castConfigured = true;
        isAvailable.value = true;
        remotePlayer = new w.cast!.framework.RemotePlayer();
        remotePlayerController = new w.cast!.framework.RemotePlayerController(remotePlayer);
        remotePlayerController.addEventListener(
          w.cast!.framework.RemotePlayerEventType.ANY_CHANGE,
          syncRemotePlayer,
        );
        // SESSION_STARTING fires once the user picks a device. Only here is it
        // safe to enter the connecting state (which tears the local player down
        // and shows the connecting UI) — doing it earlier, while the device
        // picker is still open, removes the live <video> and closes the picker.
        context.addEventListener(
          w.cast!.framework.CastContextEventType.SESSION_STATE_CHANGED,
          event => {
            const sessionState = w.cast!.framework.SessionState;
            castLog('session state', event.sessionState);
            switch (event.sessionState) {
              case sessionState.SESSION_STARTING: {
                if (pendingCastVideo) {
                  // Hand off at the live local position — the video kept
                  // playing while the picker was open
                  pendingStartTime = playback.localPositionOf(pendingCastVideo) || pendingStartTime;
                  playback.setCastConnecting(
                    pendingCastVideo.languageAgnosticNaturalKey,
                    pendingStartTime,
                  );
                }
                isConnecting.value = true;
                break;
              }
              // Only now is getCurrentSession() guaranteed to return a session
              // that can accept a load request
              case sessionState.SESSION_STARTED: {
                settleSessionWaiters(context.getCurrentSession());
                break;
              }
              // A reload mid-cast rejoins the running session (ORIGIN_SCOPED)
              case sessionState.SESSION_RESUMED: {
                settleSessionWaiters(context.getCurrentSession());
                restoreResumedSession();
                break;
              }
              case sessionState.SESSION_START_FAILED:
              case sessionState.SESSION_ENDED: {
                settleSessionWaiters(null);
                if (resumeAdoptPoll) {
                  clearInterval(resumeAdoptPoll);
                  resumeAdoptPoll = null;
                }
                isConnecting.value = false;
                pendingCastVideo = null;
                playback.castIdle();
                break;
              }
            }
          },
        );
        // Whether any device has been discovered — a cast cannot start before
        // this leaves NO_DEVICES_AVAILABLE, and nothing else reports it
        context.addEventListener(
          w.cast!.framework.CastContextEventType.CAST_STATE_CHANGED,
          event => castLog('cast state', event.castState),
        );
        castLog('cast context configured', { castState: context.getCastState?.() });
        // Auto-join can finish before Vue mounts and calls initCast, in which
        // case SESSION_RESUMED already fired with no listener attached
        if (context.getCurrentSession()) {
          restoreResumedSession();
        }
      }
      catch (error) {
        // Before the latch this leaves isAvailable false and the poll retries;
        // after it, casting still works and only the extras are missing
        reportCastError('configuring the Cast context failed', error);
      }
    };

    // Readiness is polled rather than driven off window.__onGCastApiAvailable,
    // because that global is NOT ours to own: cast_sender.js captures whatever
    // callback is installed when it runs and then overwrites the global with an
    // internal two-step counter (script onload + the framework's own call).
    // Reassigning it from here clobbers that counter, and which of the two
    // signals survives depends on whether the scripts are cached — the reason a
    // cold load left the Cast button dead while a reload "fixed" it. The real
    // precondition is just both SDK globals existing, so wait for exactly that.
    const ready = () => !!(w.cast?.framework && w.chrome?.cast);
    castLog('initCast', { ready: ready(), castApiReady: w.__castApiReady });
    if (ready()) {
      configureCast();
      return;
    }
    const startedAt = Date.now();
    const poll = setInterval(() => {
      if (ready()) {
        castLog('SDK globals appeared after', Date.now() - startedAt, 'ms');
        configureCast();
      }
      // Stop once configured, or after the SDK has clearly failed to load
      if (isAvailable.value || Date.now() - startedAt > CAST_API_TIMEOUT_MS) {
        if (!isAvailable.value) {
          castLog('gave up waiting for the Cast SDK', {
            cast: !!w.cast?.framework,
            chrome: !!w.chrome?.cast,
          });
        }
        clearInterval(poll);
      }
    }, 100);
  }

  /**
   * Resolve once a CastSession that can accept a load request exists.
   *
   * requestSession() resolves at SESSION_STARTING, well before the session is
   * usable, so loading straight after it fails on a cold page load — the whole
   * reason the first cast attempt used to silently do nothing. Resolves with
   * null when the session start fails, ends, or the receiver never comes up.
   */
  function waitForSession(timeoutMs = 15_000): Promise<CastSession | null> {
    const w = castWindow();
    const context = w.cast!.framework.CastContext.getInstance();
    const existing = context.getCurrentSession();
    if (existing) {
      return Promise.resolve(existing);
    }
    return new Promise(resolve => {
      let settled = false;
      const settle = (session: CastSession | null) => {
        if (settled) {
          return;
        }
        settled = true;
        resolve(session);
      };
      sessionWaiters.push(settle);
      // Some receivers never emit a terminal state; fall back to one last read
      setTimeout(() => settle(context.getCurrentSession()), timeoutMs);
    });
  }

  /**
   * Cast a video to a Chromecast device, optionally starting at `startTime`
   * seconds (handoff from local playback).
   * Returns true on success, false on failure or if Cast is unavailable.
   */
  async function castMedia(
    videoUrl: string,
    title: string,
    subtitleUrl?: string | null,
    startTime?: number,
    video?: Video | null,
  ): Promise<boolean> {
    castLog('castMedia', { isAvailable: isAvailable.value, hasSubtitles: !!subtitleUrl, startTime });
    if (!isAvailable.value) {
      return false;
    }
    castTitle.value = title;
    castError.value = null;
    pendingStartTime = startTime ?? 0;
    pendingCastVideo = video ?? null;
    // The slice as it stands before this attempt: if a *different* video is
    // already casting, a failure here must not wipe it — the receiver keeps
    // playing it either way
    const previousCastKey = playback.cast.kind === 'idle' ? null : playback.cast.videoKey;

    try {
      const w = castWindow();
      const context = w.cast!.framework.CastContext.getInstance();
      // Built before the session is requested so the load request is ready to
      // fire the moment a usable session lands
      const request = buildLoadRequest(videoUrl, title, subtitleUrl);

      castLog('requesting a session', {
        hasCurrentSession: !!context.getCurrentSession(),
        castState: context.getCastState?.(),
      });

      if (context.getCurrentSession()) {
        // Already casting — no device picker opens, so enter the connecting
        // state now and load the new media into the running session.
        if (video) {
          playback.setCastConnecting(video.languageAgnosticNaturalKey, pendingStartTime);
        }
        isConnecting.value = true;
      }
      else {
        // Opens the device picker. The connecting state is deferred to the
        // SESSION_STARTING handler (fires once a device is picked) so the live
        // <video> isn't torn down — and the picker closed — while it's open.
        // The picker-open window has no SDK event, so the CastButton spinner is
        // driven manually across the pending requestSession promise.
        isAwaitingDevice.value = true;
        // requestSession() has been seen to never settle at all, leaving the
        // button spinning with no SDK event to explain it — say so in the trace
        const stillPending = setTimeout(
          () => castLog('requestSession STILL PENDING after 30s', {
            castState: context.getCastState?.(),
          }),
          30_000,
        );
        let errorCode: string | null | undefined;
        try {
          // Resolves with an ErrorCode rather than rejecting on some paths
          errorCode = await context.requestSession();
          castLog('requestSession settled', { errorCode: errorCode ?? null });
        }
        finally {
          clearTimeout(stillPending);
          isAwaitingDevice.value = false;
        }
        if (errorCode) {
          throw new CastError(errorCode);
        }
      }

      // requestSession() settles at SESSION_STARTING — the session itself lands
      // later, so getCurrentSession() here would usually still be null
      const session = await waitForSession();
      castLog('session for load', { hasSession: !!session });
      if (!session) {
        throw new CastError('session_unavailable');
      }

      // pendingStartTime is re-read at SESSION_STARTING, so it reflects the
      // live local position at handoff rather than the button-press snapshot
      if (pendingStartTime > 0) {
        request.currentTime = pendingStartTime;
      }

      // Resolves when the receiver accepts the load request, which can be well
      // before the media is actually loaded — isConnecting is cleared by
      // syncRemotePlayer once the receiver reports isMediaLoaded
      await session.loadMedia(request);
      castLog('loadMedia accepted');
      hasCaptions.value = !!subtitleUrl;
      captionsEnabled.value = !!subtitleUrl;
      pendingCastVideo = null;
      return true;
    }
    catch (error) {
      const code = errorCodeOf(error);
      // A dismissed device picker is a normal outcome, not a failure
      if (code !== 'cancel') {
        reportCastError('failed to start playback', error);
        castError.value = code;
      }
      isConnecting.value = false;
      pendingStartTime = 0;
      pendingCastVideo = null;
      if (previousCastKey) {
        // Something else is still on the receiver — point the slice back at it
        // and let the RemotePlayer events promote it to active again
        playback.setCastConnecting(previousCastKey, playback.lastCastPosition);
      }
      else {
        playback.castIdle();
      }
      return false;
    }
  }

  function clearCastError() {
    castError.value = null;
  }

  // Remote playback controls, driven by the RemotePlayerController

  function togglePlay() {
    remotePlayerController?.playOrPause();
  }

  function toggleMute() {
    remotePlayerController?.muteOrUnmute();
  }

  function setVolume(level: number) {
    if (!remotePlayer || !remotePlayerController) {
      return;
    }
    remotePlayer.volumeLevel = level;
    remotePlayerController.setVolumeLevel();
  }

  function seekTo(seconds: number) {
    if (!remotePlayer || !remotePlayerController) {
      return;
    }
    remotePlayer.currentTime = Math.min(Math.max(seconds, 0), duration.value);
    remotePlayerController.seek();
  }

  function skip(deltaSeconds: number) {
    seekTo(currentTime.value + deltaSeconds);
  }

  function toggleCaptions() {
    const w = castWindow();
    const mediaSession = w.cast?.framework.CastContext.getInstance()
      .getCurrentSession()
      ?.getMediaSession();
    if (!mediaSession || !hasCaptions.value) {
      return;
    }
    const activeTrackIds = captionsEnabled.value ? [] : [SUBTITLE_TRACK_ID];
    const request = new w.chrome!.cast.media.EditTracksInfoRequest(activeTrackIds);
    mediaSession.editTracksInfo(
      request,
      () => {
        captionsEnabled.value = !captionsEnabled.value;
      },
      () => {},
    );
  }

  function stopCasting() {
    const w = castWindow();
    w.cast?.framework.CastContext.getInstance().endCurrentSession(true);
  }

  return {
    isAvailable,
    isAwaitingDevice,
    castError,
    clearCastError,
    isMuted,
    volumeLevel,
    canSeek,
    canPause,
    castDeviceName,
    castTitle,
    hasCaptions,
    captionsEnabled,
    initCast,
    castMedia,
    togglePlay,
    toggleMute,
    setVolume,
    seekTo,
    skip,
    toggleCaptions,
    stopCasting,
  };
}

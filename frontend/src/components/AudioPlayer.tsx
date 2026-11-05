import { usePlayerStore } from "@/stores/usePlayerStore";
import { useEffect, useRef } from "react";
import { useChatStore } from "@/stores/useChatStore";
import { useUser } from "@clerk/clerk-react";
import toast from "react-hot-toast";

const trackIdOf = (song: { _id?: string; id?: string } | null | undefined) =>
  song?._id || song?.id || "";

const AudioPlayer = () => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const prevSrcRef = useRef<string | null>(null);
  const prevIdRef = useRef<string | null>(null);
  const errorSkipRef = useRef(false);

  const {
    currentSong,
    isPlaying,
    shouldAutoplay,
    setShouldAutoplay,
    playNext,
    volume,
    setPlaybackError,
    setBuffering,
    setPlaybackDiagnostics,
    playbackDiagnostics,
    repeatMode,
  } = usePlayerStore();

  const { socket } = useChatStore();
  const { user } = useUser();

  useEffect(() => {
    if (socket && user) {
      const activity = isPlaying
        ? `Playing ${currentSong?.title} by ${currentSong?.artist}`
        : "Idle";
      socket.emit("update_activity", { userId: user.id, activity });
    }
  }, [isPlaying, currentSong, socket, user]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
  }, [volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentSong) return;

    const nextSrc = currentSong.audioUrl;
    const songId = trackIdOf(currentSong);
    if (!nextSrc) {
      setPlaybackError("No playable audio for this track");
      return;
    }

    const trackChanged =
      prevIdRef.current !== songId || prevSrcRef.current !== nextSrc;

    if (trackChanged) {
      errorSkipRef.current = false;
      // Clear previous source completely so a preview URL cannot stick after upgrade
      audio.removeAttribute("src");
      audio.load();
      audio.src = nextSrc;
      audio.currentTime = 0;
      prevSrcRef.current = nextSrc;
      prevIdRef.current = songId;
      setBuffering(true);

      if (shouldAutoplay || isPlaying) {
        audio
          .play()
          .catch((err) => {
            setPlaybackError(err?.message || "Unable to start playback");
            toast.error("Tap play — mobile browsers block autoplay");
          })
          .finally(() => setShouldAutoplay(false));
      }
    } else if (shouldAutoplay) {
      audio.currentTime = 0;
      audio
        .play()
        .catch(() => {})
        .finally(() => setShouldAutoplay(false));
    }
  }, [
    currentSong,
    shouldAutoplay,
    isPlaying,
    setShouldAutoplay,
    setPlaybackError,
    setBuffering,
  ]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.play().catch((err) => {
        setPlaybackError(err?.message || "Playback blocked");
      });
    } else {
      audio.pause();
    }
  }, [isPlaying, setPlaybackError]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onEnded = () => {
      if (repeatMode === "one") {
        audio.currentTime = 0;
        audio.play().catch(() => {});
        return;
      }
      void playNext();
    };

    const onError = () => {
      const code = audio.error?.code ?? null;
      setPlaybackError("Audio failed to load. The stream may have expired.");
      setBuffering(false);
      setPlaybackDiagnostics({
        ...(playbackDiagnostics || {}),
        mediaErrorCode: code,
        audioReadyState: audio.readyState,
        note: "HTML5 media error — not skipping automatically on first failure",
      });
      // Avoid infinite skip loops on mobile; only advance once per track after user context
      if (!errorSkipRef.current && repeatMode !== "one") {
        errorSkipRef.current = true;
        window.setTimeout(() => {
          void playNext();
        }, 400);
      }
    };

    const onWaiting = () => setBuffering(true);
    const onCanPlay = () => {
      setBuffering(false);
      setPlaybackDiagnostics({
        ...(usePlayerStore.getState().playbackDiagnostics || {}),
        audioReadyState: audio.readyState,
        actualDuration: Number.isFinite(audio.duration) ? audio.duration : null,
        mediaErrorCode: null,
      });
    };

    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("canplay", onCanPlay);

    return () => {
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("canplay", onCanPlay);
    };
  }, [
    playNext,
    repeatMode,
    setPlaybackError,
    setBuffering,
    setPlaybackDiagnostics,
    playbackDiagnostics,
  ]);

  return <audio ref={audioRef} preload="metadata" playsInline />;
};

export default AudioPlayer;

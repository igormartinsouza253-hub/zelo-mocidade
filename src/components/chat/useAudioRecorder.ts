import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type RecorderState = {
  supported: boolean;
  recording: boolean;
  mimeType: string | null;
  error: string | null;
};

const MIME_CANDIDATES = [
  // Chrome/Android (melhor compat + qualidade)
  "audio/webm;codecs=opus",
  "audio/webm",
  // Safari/iOS costuma preferir mp4
  "audio/mp4",
  // fallback
  "audio/ogg;codecs=opus",
] as const;

function pickSupportedMime(): string | null {
  if (typeof window === "undefined") return null;
  const mr: any = (window as any).MediaRecorder;
  if (!mr?.isTypeSupported) return null;

  for (const mt of MIME_CANDIDATES) {
    try {
      if (mr.isTypeSupported(mt)) return mt;
    } catch {
      // ignore
    }
  }
  return null;
}

function extFromMime(mimeType: string) {
  const mt = (mimeType || "").toLowerCase();
  if (mt.includes("mp4")) return "m4a";
  if (mt.includes("webm")) return "webm";
  if (mt.includes("ogg")) return "ogg";
  return "webm";
}

export function useAudioRecorder() {
  const [state, setState] = useState<RecorderState>({
    supported: typeof window !== "undefined" && "MediaRecorder" in window,
    recording: false,
    mimeType: null,
    error: null,
  });

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const preferredMime = useMemo(() => pickSupportedMime(), []);

  const start = useCallback(async () => {
    if (!state.supported) {
      setState((s) => ({ ...s, error: "Navegador não suporta gravação." }));
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;
      chunksRef.current = [];

      const recorder = new MediaRecorder(stream, preferredMime ? { mimeType: preferredMime } : undefined);
      recorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.start(250);
      setState((s) => ({ ...s, recording: true, mimeType: recorder.mimeType || preferredMime, error: null }));
    } catch (e: any) {
      setState((s) => ({ ...s, recording: false, error: e?.message ?? "Falha ao acessar microfone." }));
    }
  }, [preferredMime, state.supported]);

  const stop = useCallback(async (): Promise<{ blob: Blob; mimeType: string; fileName: string } | null> => {
    const recorder = recorderRef.current;
    if (!recorder) return null;

    return await new Promise((resolve) => {
      recorder.onstop = () => {
        const mimeType = recorder.mimeType || state.mimeType || preferredMime || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const fileName = `audio-${Date.now()}.${extFromMime(mimeType)}`;

        // stop mic (após o onstop para não interromper o flush do MediaRecorder)
        streamRef.current?.getTracks()?.forEach((t) => t.stop());
        streamRef.current = null;
        recorderRef.current = null;

        resolve({ blob, mimeType, fileName });
      };

      try {
        // tenta "flush" antes de parar
        recorder.requestData?.();
      } catch {
        // ignore
      }

      try {
        recorder.stop();
      } catch {
        // fallback: resolve mesmo sem evento
        const mimeType = recorder.mimeType || state.mimeType || preferredMime || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const fileName = `audio-${Date.now()}.${extFromMime(mimeType)}`;
        streamRef.current?.getTracks()?.forEach((t) => t.stop());
        streamRef.current = null;
        recorderRef.current = null;
        resolve({ blob, mimeType, fileName });
      }

      setState((s) => ({ ...s, recording: false }));
    });
  }, [preferredMime, state.mimeType]);

  useEffect(() => {
    return () => {
      try {
        recorderRef.current?.stop();
      } catch {
        // ignore
      }
      streamRef.current?.getTracks()?.forEach((t) => t.stop());
    };
  }, []);

  return {
    ...state,
    start,
    stop,
  };
}

/**
 * Record canvas + audio as video.
 * MP4 (via mp4-muxer + WebCodecs) on supported browsers, WebM fallback elsewhere.
 */

import { Muxer, ArrayBufferTarget } from "mp4-muxer";

/* eslint-disable @typescript-eslint/no-explicit-any */
// WebCodecs API — available in Chrome/Edge, not yet in TS lib
declare const VideoEncoder: any;
declare const VideoFrame: any;
declare const AudioEncoder: any;
declare const AudioData: any;

export interface VideoRecorderHandle {
  stop: () => void;
}

const FPS = 30;
const VIDEO_BITRATE = 2_500_000;
const AUDIO_BITRATE = 128_000;
const AUDIO_SAMPLE_RATE = 48000;

/** Check if WebCodecs API is available AND codecs are supported for MP4 recording. */
function canUseMp4(): boolean {
  if (typeof VideoEncoder === "undefined" || typeof AudioEncoder === "undefined") return false;
  // Firefox/Safari expose WebCodecs but have issues with mp4-muxer — only use on Chromium
  const isChromium = /Chrome/i.test(navigator.userAgent) && !/Firefox|Edg/i.test(navigator.userAgent) || /Edg/i.test(navigator.userAgent);
  return isChromium;
}

/** Start MP4 recording using WebCodecs + mp4-muxer. */
function startMp4Recording(
  canvas: HTMLCanvasElement,
  analyser: AnalyserNode,
  onDone: (blob: Blob, ext: string) => void,
): VideoRecorderHandle | null {
  const audioCtx = analyser.context as AudioContext;
  const w = canvas.width;
  const h = canvas.height;

  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: { codec: "avc", width: w, height: h },
    audio: { codec: "aac", numberOfChannels: 2, sampleRate: audioCtx.sampleRate },
    fastStart: "in-memory",
  });

  // Video encoder
  const videoEncoder = new VideoEncoder({
    output: (chunk: any, meta: any) => muxer.addVideoChunk(chunk, meta),
    error: (e: any) => console.error("VideoEncoder error:", e),
  });
  videoEncoder.configure({
    codec: "avc1.640028",
    width: w,
    height: h,
    bitrate: VIDEO_BITRATE,
    framerate: FPS,
  });

  // Audio encoder — use the actual audio context sample rate
  const actualSampleRate = audioCtx.sampleRate;
  const audioEncoder = new AudioEncoder({
    output: (chunk: any, meta: any) => muxer.addAudioChunk(chunk, meta),
    error: (e: any) => console.error("AudioEncoder error:", e),
  });
  audioEncoder.configure({
    codec: "mp4a.40.2",
    numberOfChannels: 2,
    sampleRate: actualSampleRate,
    bitrate: AUDIO_BITRATE,
  });

  // Capture audio via ScriptProcessorNode
  const processor = audioCtx.createScriptProcessor(4096, 2, 2);
  let audioTimestamp = 0;
  processor.onaudioprocess = (e) => {
    if (stopped) return;
    try {
      const left = e.inputBuffer.getChannelData(0);
      const right = e.inputBuffer.getChannelData(1);
      // Planar format: left samples then right samples
      const planar = new Float32Array(left.length + right.length);
      planar.set(left, 0);
      planar.set(right, left.length);
      const audioData = new AudioData({
        format: "f32-planar",
        sampleRate: actualSampleRate,
        numberOfFrames: left.length,
        numberOfChannels: 2,
        timestamp: audioTimestamp,
        data: planar,
      });
      audioTimestamp += (left.length / actualSampleRate) * 1_000_000;
      audioEncoder.encode(audioData);
      audioData.close();
    } catch (err) {
      console.error("Audio capture error:", err);
    }
  };
  analyser.connect(processor);
  processor.connect(audioCtx.destination);

  // Capture video frames
  let frameCount = 0;
  let stopped = false;
  const frameInterval = setInterval(() => {
    if (stopped) return;
    const frame = new VideoFrame(canvas, { timestamp: (frameCount / FPS) * 1_000_000 });
    const keyFrame = frameCount % (FPS * 2) === 0; // keyframe every 2s
    videoEncoder.encode(frame, { keyFrame });
    frame.close();
    frameCount++;
  }, 1000 / FPS);

  const stop = async () => {
    stopped = true;
    clearInterval(frameInterval);
    analyser.disconnect(processor);
    processor.disconnect();
    await videoEncoder.flush();
    await audioEncoder.flush();
    muxer.finalize();
    videoEncoder.close();
    audioEncoder.close();
    const blob = new Blob([target.buffer], { type: "video/mp4" });
    onDone(blob, "mp4");
  };

  return { stop: () => { stop(); } };
}

/** Start WebM recording via MediaRecorder (fallback). */
function startWebmRecording(
  canvas: HTMLCanvasElement,
  analyser: AnalyserNode,
  onDone: (blob: Blob, ext: string) => void,
): VideoRecorderHandle | null {
  try {
    const ctx = analyser.context as AudioContext;
    const videoStream = canvas.captureStream(FPS);
    const audioDest = ctx.createMediaStreamDestination();
    analyser.connect(audioDest);

    const combined = new MediaStream([
      ...videoStream.getVideoTracks(),
      ...audioDest.stream.getAudioTracks(),
    ]);

    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
      ? "video/webm;codecs=vp9,opus"
      : MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")
        ? "video/webm;codecs=vp8,opus"
        : "video/webm";

    const recorder = new MediaRecorder(combined, { mimeType, videoBitsPerSecond: VIDEO_BITRATE });
    const chunks: Blob[] = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = () => {
      analyser.disconnect(audioDest);
      const blob = new Blob(chunks, { type: "video/webm" });
      onDone(blob, "webm");
    };

    recorder.start();
    return { stop: () => recorder.stop() };
  } catch {
    return null;
  }
}

/** Start video recording — MP4 when possible, WebM fallback. */
export function startVideoRecording(
  canvas: HTMLCanvasElement,
  analyser: AnalyserNode,
  onDone: (blob: Blob, ext: string) => void,
): VideoRecorderHandle | null {
  if (canUseMp4()) {
    try {
      return startMp4Recording(canvas, analyser, onDone);
    } catch {
      // Fall through to WebM
    }
  }
  return startWebmRecording(canvas, analyser, onDone);
}

/** Download a blob as a file. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Prompt for filename and save video. */
export async function saveVideo(blob: Blob, ext: string): Promise<void> {
  const date = new Date().toISOString().slice(0, 16).replace(/[T:]/g, "-");
  const defaultName = `mpump-${date}`;
  const mime = ext === "mp4" ? "video/mp4" : "video/webm";

  if ("showSaveFilePicker" in window) {
    try {
      const handle = await (window as unknown as { showSaveFilePicker: (opts: unknown) => Promise<FileSystemFileHandle> }).showSaveFilePicker({
        suggestedName: `${defaultName}.${ext}`,
        types: [{ description: `${ext.toUpperCase()} video`, accept: { [mime]: [`.${ext}`] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
    }
  }

  const name = prompt("Save video as:", defaultName);
  if (!name) return;
  downloadBlob(blob, name.endsWith(`.${ext}`) ? name : `${name}.${ext}`);
}

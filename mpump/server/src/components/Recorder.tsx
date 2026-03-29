import { useState, useRef, useCallback } from "react";
import { heavyVibrate } from "../utils/haptic";

interface Props {
  getAnalyser: () => AnalyserNode | null;
  onExport?: () => void;
}

/** Write an ASCII string into a DataView. */
function ws(view: DataView, o: number, s: string): void {
  for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i));
}

/** Build a LIST/INFO metadata chunk for WAV files. */
function buildInfoChunk(meta: Record<string, string>): ArrayBuffer {
  const tags: [string, string][] = [];
  if (meta.title) tags.push(["INAM", meta.title]);
  if (meta.artist) tags.push(["IART", meta.artist]);
  if (meta.software) tags.push(["ISFT", meta.software]);
  if (meta.date) tags.push(["ICRD", meta.date]);
  if (tags.length === 0) return new ArrayBuffer(0);

  let bodySize = 4; // "INFO"
  for (const [, val] of tags) {
    const strLen = val.length + 1;
    bodySize += 4 + 4 + (strLen % 2 === 0 ? strLen : strLen + 1);
  }
  const buf = new ArrayBuffer(8 + bodySize);
  const view = new DataView(buf);
  let off = 0;
  ws(view, off, "LIST"); off += 4;
  view.setUint32(off, bodySize, true); off += 4;
  ws(view, off, "INFO"); off += 4;
  for (const [tag, val] of tags) {
    ws(view, off, tag); off += 4;
    const strLen = val.length + 1;
    const padded = strLen % 2 === 0 ? strLen : strLen + 1;
    view.setUint32(off, strLen, true); off += 4;
    ws(view, off, val); off += val.length;
    view.setUint8(off, 0); off++;
    if (padded > strLen) { view.setUint8(off, 0); off++; }
  }
  return buf;
}

/** Build a WAV blob from raw PCM float samples (stereo) with metadata. */
function float32ToWav(samples: Float32Array[], sampleRate: number): Blob {
  const numChannels = samples.length;
  const numSamples = samples[0].length;
  const bytesPerSample = 2;
  const dataSize = numSamples * numChannels * bytesPerSample;

  const infoChunk = buildInfoChunk({
    title: "mpump recording",
    software: "mpump — https://mpump.live",
    date: new Date().toISOString().slice(0, 10),
  });
  const infoSize = infoChunk.byteLength;

  const totalSize = 44 + infoSize + dataSize;
  const buf = new ArrayBuffer(totalSize);
  const view = new DataView(buf);

  ws(view, 0, "RIFF");
  view.setUint32(4, totalSize - 8, true);
  ws(view, 8, "WAVE");
  ws(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true);
  view.setUint16(32, numChannels * bytesPerSample, true);
  view.setUint16(34, 16, true);

  let offset = 36;
  if (infoSize > 0) {
    new Uint8Array(buf, offset, infoSize).set(new Uint8Array(infoChunk));
    offset += infoSize;
  }

  ws(view, offset, "data");
  view.setUint32(offset + 4, dataSize, true);
  offset += 8;

  for (let i = 0; i < numSamples; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const s = Math.max(-1, Math.min(1, samples[ch][i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      offset += 2;
    }
  }
  return new Blob([buf], { type: "audio/wav" });
}

/** Prompt for filename and save WAV file. */
async function saveWav(blob: Blob, defaultName: string): Promise<void> {
  if ("showSaveFilePicker" in window) {
    try {
      const handle = await (window as unknown as { showSaveFilePicker: (opts: unknown) => Promise<FileSystemFileHandle> }).showSaveFilePicker({
        suggestedName: `${defaultName}.wav`,
        types: [{ description: "WAV audio", accept: { "audio/wav": [".wav"] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
    }
  }
  const name = prompt("Save audio as:", defaultName);
  if (!name) return;
  const filename = name.endsWith(".wav") ? name : `${name}.wav`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Record audio output directly to WAV via ScriptProcessorNode.
 * Captures raw PCM — no MediaRecorder, no WebM intermediate.
 */
export function Recorder({ getAnalyser, onExport }: Props) {
  const [recording, setRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const buffersRef = useRef<{ L: Float32Array[]; R: Float32Array[] }>({ L: [], R: [] });
  const timerRef = useRef<number>(0);
  const startTimeRef = useRef(0);
  const analyserRef = useRef<AnalyserNode | null>(null);

  const start = useCallback(() => {
    const analyser = getAnalyser();
    if (!analyser) return;
    analyserRef.current = analyser;

    const ctx = analyser.context as AudioContext;
    // ScriptProcessorNode captures raw PCM from the audio graph
    const processor = ctx.createScriptProcessor(4096, 2, 2);
    buffersRef.current = { L: [], R: [] };

    processor.onaudioprocess = (e) => {
      // Copy input buffers (they get reused)
      buffersRef.current.L.push(new Float32Array(e.inputBuffer.getChannelData(0)));
      buffersRef.current.R.push(new Float32Array(e.inputBuffer.getChannelData(1)));
    };

    analyser.connect(processor);
    processor.connect(ctx.destination); // must be connected to destination to fire
    processorRef.current = processor;
    startTimeRef.current = Date.now();
    setRecording(true);
    setDuration(0);
    timerRef.current = window.setInterval(() => {
      setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 500);
  }, [getAnalyser]);

  const stop = useCallback(() => {
    const processor = processorRef.current;
    const analyser = analyserRef.current;
    if (processor && analyser) {
      analyser.disconnect(processor);
      processor.disconnect();
    }
    processorRef.current = null;
    setRecording(false);
    window.clearInterval(timerRef.current);

    // Merge buffers and save as WAV
    const { L, R } = buffersRef.current;
    if (L.length === 0) return;
    const totalLen = L.reduce((sum, b) => sum + b.length, 0);
    const left = new Float32Array(totalLen);
    const right = new Float32Array(totalLen);
    let offset = 0;
    for (let i = 0; i < L.length; i++) {
      left.set(L[i], offset);
      right.set(R[i], offset);
      offset += L[i].length;
    }
    const sampleRate = (analyser?.context as AudioContext)?.sampleRate ?? 44100;
    const wavBlob = float32ToWav([left, right], sampleRate);
    const date = new Date().toISOString().slice(0, 16).replace(/[T:]/g, "-");
    saveWav(wavBlob, `mpump-${date}`);
    onExport?.();
  }, [onExport]);

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <button
      className={`rec-btn ${recording ? "active" : ""}`}
      onClick={() => { heavyVibrate(); recording ? stop() : start(); }}
      title={recording ? "Stop recording" : "Record audio to WAV"}
    >
      {recording ? `⏺ ${fmt(duration)}` : "REC"}
    </button>
  );
}

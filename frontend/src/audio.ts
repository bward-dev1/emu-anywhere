/**
 * One place that owns emulator sound.
 *
 * Two things were wrong before this file existed.
 *
 * 1. Nothing ever unlocked the AudioContext the *cores* actually play through.
 *    ios.ts builds its own AudioContext and resumes that one, which unlocks
 *    nothing audible: mGBA plays through `module.SDL2.audioContext` and WebMelon
 *    plays through `WebMelon._internal.emulatorAudioCtx`, and those are separate
 *    objects. (ios.ts's initAudioUnlock is now redundant and should go when the
 *    touch branch lands -- see the note at the bottom of this file.)
 * 2. Neither core's volume was ever set, and there was no way for the user to
 *    change it.
 *
 * The unlock rule that matters is WebKit's, not Chrome's. Chrome will start an
 * AudioContext once the *page* has been interacted with at all, which is why GBA
 * sound works on a desktop browser today. Safari requires the resume() call
 * itself to happen inside a user-gesture handler. Both cores build their context
 * several async ticks after the tap on Play, so on iOS they start suspended and
 * nothing ever brings them back. Hence: listeners that resume on every gesture,
 * for as long as anything is still suspended, plus a resume when the tab becomes
 * visible again (iOS suspends on background and does not restore on its own).
 */

const STORAGE_KEY = 'emu-audio-settings';

export interface AudioSettings {
  /** 0..1. Mapped straight onto mGBA's 0.0..2.0 volume, so 1 = 100%. */
  volume: number;
  muted: boolean;
}

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = { volume: 0.8, muted: false };

const clamp01 = (v: number) => (Number.isFinite(v) ? Math.min(Math.max(v, 0), 1) : 1);

const readStored = (): AudioSettings => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_AUDIO_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<AudioSettings>;
    return {
      volume: clamp01(parsed.volume ?? DEFAULT_AUDIO_SETTINGS.volume),
      muted: !!parsed.muted
    };
  } catch {
    // Private browsing, or a hand-edited value. Defaults always work.
    return { ...DEFAULT_AUDIO_SETTINGS };
  }
};

const writeStored = (settings: AudioSettings) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Still applies for this session.
  }
};

let settings: AudioSettings = readStored();
const listeners = new Set<(s: AudioSettings) => void>();

/**
 * A running core's audio, described in the only two terms this module needs:
 * where its AudioContext is, and how to set its level.
 *
 * `context` is a getter rather than a value because WebMelon throws its
 * AudioContext away and builds a new one on every shutdown, so a captured
 * reference goes stale the moment you stop a DS game.
 */
export interface AudioSink {
  id: string;
  context: () => AudioContext | null;
  /** Called with the effective 0..1 level (already zero when muted). */
  applyVolume: (level: number) => void;
  /** Extra work on a genuine user gesture, e.g. mGBA's own resumeAudio(). */
  onUnlock?: () => void;
  /**
   * True while the core is deliberately paused. A gesture must not un-suspend a
   * paused game's context -- WebMelon uses suspend() as its actual pause.
   */
  holdSuspended?: () => boolean;
  /**
   * The node carrying this core's output, for measurement only. A getter
   * because a core may not have built its graph yet when it registers -- mGBA
   * opens its SDL2 audio device during loadGame, WebMelon adds its worklet node
   * from an async addModule().
   */
  analyserSource?: () => AudioNode | null;
}

const sinks = new Map<string, AudioSink>();
const analysers = new Map<string, AnalyserNode>();

/*
 * Volume for a core that has no volume API of its own.
 *
 * mGBA exposes setVolume(), so the GBA sink just calls it. WebMelon has no
 * equivalent -- it wires its AudioWorkletNode straight into ctx.destination --
 * so the only way in is to put a GainNode in front of the speakers.
 *
 * The awkward part is timing: WebMelon creates that node inside an async
 * createAudioProcessor() (it has to await audioWorklet.addModule), so at the
 * moment we attach there is usually nothing to re-route yet, and polling for it
 * is a race. Instead we claim the destination: once a context is registered
 * here, anything that later connects to its destination is transparently
 * connected to our gain node instead. No polling, and it works for both the
 * worklet path and the ScriptProcessor fallback.
 *
 * Scoped by construction -- the patched connect() only diverts contexts that are
 * in destinationGains, so every other AudioContext on the page is untouched.
 */
const destinationGains = new WeakMap<BaseAudioContext, GainNode>();
const nativeConnect = AudioNode.prototype.connect;
let connectPatched = false;

function patchConnectOnce(): void {
  if (connectPatched) return;
  connectPatched = true;

  (AudioNode.prototype as any).connect = function (this: AudioNode, dest: any, ...rest: any[]) {
    if (typeof AudioDestinationNode !== 'undefined' && dest instanceof AudioDestinationNode) {
      const gain = destinationGains.get(dest.context);
      // gain !== this keeps the gain node's own hop to the real destination from
      // being redirected back into itself.
      if (gain && gain !== (this as unknown as GainNode)) {
        return (nativeConnect as any).call(this, gain, ...rest);
      }
    }
    return (nativeConnect as any).call(this, dest, ...rest);
  };
}

/** The GainNode standing between `ctx` and the speakers, created on first use. */
export function destinationGainFor(ctx: AudioContext): GainNode {
  patchConnectOnce();
  let gain = destinationGains.get(ctx);
  if (!gain) {
    gain = ctx.createGain();
    (nativeConnect as any).call(gain, ctx.destination);
    destinationGains.set(ctx, gain);
  }
  return gain;
}

const effectiveLevel = () => (settings.muted ? 0 : settings.volume);

function applyToAll(): void {
  for (const sink of sinks.values()) {
    try {
      sink.applyVolume(effectiveLevel());
    } catch (error) {
      console.warn(`Failed to set volume on ${sink.id}:`, error);
    }
  }
}

/**
 * Resume every registered context.
 *
 * Deliberately fire-and-forget per sink: on Safari a resume() that is not
 * allowed yet rejects, and one rejection must not stop us trying the others or
 * trying again on the next gesture.
 */
export function unlockAudio(): void {
  for (const sink of sinks.values()) {
    if (sink.holdSuspended?.()) continue;
    const ctx = sink.context();
    if (ctx && ctx.state !== 'running' && ctx.state !== 'closed') {
      ctx.resume().catch(() => {});
    }
    try {
      sink.onUnlock?.();
    } catch {
      // A core that is mid-teardown can throw here. Not worth surfacing.
    }
  }
}

let gesturesArmed = false;

/**
 * Keep the gesture listeners installed permanently rather than removing them
 * after the first unlock. iOS re-suspends the context whenever the app is
 * backgrounded or the ringer switch is flipped, so "unlock once" is not enough.
 * The handler is a no-op when everything is already running.
 */
function armGestureUnlock(): void {
  if (gesturesArmed) return;
  gesturesArmed = true;

  const onGesture = () => unlockAudio();
  const opts: AddEventListenerOptions = { capture: true, passive: true };
  document.addEventListener('pointerdown', onGesture, opts);
  document.addEventListener('touchend', onGesture, opts);
  document.addEventListener('mousedown', onGesture, opts);
  document.addEventListener('keydown', onGesture, opts);
  document.addEventListener('click', onGesture, opts);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') unlockAudio();
  });
  window.addEventListener('focus', onGesture);
  window.addEventListener('pageshow', onGesture);
}

/**
 * Attach a measurement tap, if the sink's output node exists yet. Returns the
 * analyser once there is one; called again on each diagnostics read so a graph
 * that appeared late still gets measured.
 */
function ensureAnalyser(sink: AudioSink): AnalyserNode | undefined {
  const existing = analysers.get(sink.id);
  if (existing) return existing;

  const source = sink.analyserSource?.();
  if (!source) return undefined;

  try {
    const analyser = source.context.createAnalyser();
    analyser.fftSize = 2048;
    // A tap, not a link in the chain: the analyser has no output connected, so
    // it cannot alter or gate what reaches the speakers.
    source.connect(analyser);
    analysers.set(sink.id, analyser);
    return analyser;
  } catch (error) {
    console.warn('Could not attach audio analyser:', error);
    return undefined;
  }
}

export function registerAudioSink(sink: AudioSink): void {
  sinks.set(sink.id, sink);
  armGestureUnlock();
  ensureAnalyser(sink);
  // The graph often does not exist yet at this point (WebMelon's worklet arrives
  // from an async addModule). Retry for a few seconds so a diagnostics read has
  // a populated analyser to look at rather than reporting an initial zero.
  for (const delay of [250, 1000, 3000]) {
    setTimeout(() => {
      if (sinks.get(sink.id) === sink) ensureAnalyser(sink);
    }, delay);
  }

  try {
    sink.applyVolume(effectiveLevel());
  } catch (error) {
    console.warn(`Failed to set initial volume on ${sink.id}:`, error);
  }
  unlockAudio();
}

export function unregisterAudioSink(id: string): void {
  sinks.delete(id);
  analysers.delete(id);
}

export function getAudioSettings(): AudioSettings {
  return settings;
}

export function setAudioSettings(patch: Partial<AudioSettings>): AudioSettings {
  const next: AudioSettings = {
    volume: patch.volume === undefined ? settings.volume : clamp01(patch.volume),
    muted: patch.muted === undefined ? settings.muted : !!patch.muted
  };
  settings = next;
  writeStored(next);
  applyToAll();
  // Nudging the slider is itself a gesture, so it is a good moment to retry a
  // context that Safari refused to start earlier.
  unlockAudio();
  for (const listener of listeners) listener(next);
  return next;
}

export function subscribeAudioSettings(listener: (s: AudioSettings) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export interface AudioDiagnostic {
  id: string;
  state: AudioContextState | 'none';
  sampleRate: number | null;
  /** Root-mean-square of the last ~2048 samples. 0 means genuine silence. */
  rms: number | null;
  peak: number | null;
  volume: number;
  muted: boolean;
}

/**
 * Read the real numbers, so "audio works" can be checked instead of assumed.
 * Exposed on window as __emuAudio below.
 */
export function getAudioDiagnostics(): AudioDiagnostic[] {
  return Array.from(sinks.values()).map((sink) => {
    const ctx = sink.context();
    const analyser = ensureAnalyser(sink);
    let rms: number | null = null;
    let peak: number | null = null;

    if (analyser) {
      const buf = new Float32Array(analyser.fftSize);
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      let max = 0;
      for (let i = 0; i < buf.length; i++) {
        const v = buf[i];
        sum += v * v;
        if (Math.abs(v) > max) max = Math.abs(v);
      }
      rms = Math.sqrt(sum / buf.length);
      peak = max;
    }

    return {
      id: sink.id,
      state: ctx ? ctx.state : 'none',
      sampleRate: ctx ? ctx.sampleRate : null,
      rms,
      peak,
      volume: settings.volume,
      muted: settings.muted
    };
  });
}

declare global {
  interface Window {
    __emuAudio?: {
      diagnostics: () => AudioDiagnostic[];
      unlock: () => void;
      settings: () => AudioSettings;
      set: (patch: Partial<AudioSettings>) => AudioSettings;
    };
  }
}

if (typeof window !== 'undefined') {
  // A support handle, not an API: "is there actually sound coming out, and at
  // what level" is otherwise unanswerable from a console on someone's iPad.
  window.__emuAudio = {
    diagnostics: getAudioDiagnostics,
    unlock: unlockAudio,
    settings: getAudioSettings,
    set: setAudioSettings
  };
}

/*
 * NOTE for whoever merges the touch/mobile branch: frontend/src/ios.ts still has
 * initAudioUnlock(), resumeAudio() and getAudioContext(). They build and resume a
 * private AudioContext that no core ever plays through, so they unlock nothing
 * and only make it look like audio is handled. Delete them (and the audioContext
 * / resumeAudio fields on iOSContext) once that branch lands; this module is the
 * real unlock. Left untouched here only because ios.ts belongs to that branch.
 */

export interface iOSContext {
  audioContext: AudioContext | null;
  resumeAudio: () => Promise<void>;
  isStandalone: boolean;
  onViewportResize: ((width: number, height: number) => void) | undefined;
  cleanup: () => void;
}

let audioContext: AudioContext | null = null;
let wakeLockSentinel: WakeLockSentinel | null = null;
let viewportResizeCallback: ((width: number, height: number) => void) | undefined;

const resumeAudio = async () => {
  if (!audioContext) return;
  if (audioContext.state === 'suspended') {
    try {
      await audioContext.resume();
      const buffer = audioContext.createBuffer(1, 1, 44100);
      const source = audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContext.destination);
      source.start(0);
    } catch (e) {
      console.warn('Failed to resume audio context:', e);
    }
  }
};

const initAudioUnlock = () => {
  try {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  } catch (e) {
    console.warn('AudioContext not available:', e);
    return;
  }

  const unlock = async () => {
    await resumeAudio();
    document.removeEventListener('touchend', unlock);
    document.removeEventListener('pointerdown', unlock);
  };

  document.addEventListener('touchend', unlock, false);
  document.addEventListener('pointerdown', unlock, false);
};

const preventZoomAndScroll = () => {
  document.addEventListener('gesturestart', (e) => {
    e.preventDefault();
  }, { passive: false });

  document.addEventListener('touchstart', (e) => {
    if (e.touches.length > 1) {
      e.preventDefault();
    }
  }, { passive: false });

  document.body.style.overscrollBehavior = 'none';
};

const initWakeLock = () => {
  if (!navigator.wakeLock) {
    console.warn('Wake Lock API not available');
    return;
  }

  const requestWakeLock = async () => {
    try {
      wakeLockSentinel = await navigator.wakeLock.request('screen');
      wakeLockSentinel.addEventListener('release', () => {
        console.log('Wake Lock released');
      });
    } catch (e) {
      console.warn('Failed to acquire wake lock:', e);
    }
  };

  requestWakeLock();

  document.addEventListener('visibilitychange', async () => {
    if (document.hidden) {
      wakeLockSentinel?.release().catch(() => {});
      wakeLockSentinel = null;
    } else {
      requestWakeLock();
    }
  });
};

const getStandaloneStatus = (): boolean => {
  if (typeof navigator !== 'undefined') {
    if ((navigator as any).standalone === true) {
      return true;
    }
  }

  if (typeof window !== 'undefined' && window.matchMedia) {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      return true;
    }
  }

  return false;
};

const initViewportResize = (callback: (width: number, height: number) => void) => {
  viewportResizeCallback = callback;

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => {
      if (viewportResizeCallback && window.visualViewport) {
        viewportResizeCallback(window.visualViewport.width || window.innerWidth, window.visualViewport.height || window.innerHeight);
      }
    });

    if (viewportResizeCallback) {
      viewportResizeCallback(window.visualViewport.width || window.innerWidth, window.visualViewport.height || window.innerHeight);
    }
  } else {
    window.addEventListener('resize', () => {
      if (viewportResizeCallback) {
        viewportResizeCallback(window.innerWidth, window.innerHeight);
      }
    });

    if (viewportResizeCallback) {
      viewportResizeCallback(window.innerWidth, window.innerHeight);
    }
  }
};

export const initIOS = (viewportResizeCallback?: (width: number, height: number) => void): iOSContext => {
  initAudioUnlock();
  preventZoomAndScroll();
  initWakeLock();

  if (viewportResizeCallback) {
    initViewportResize(viewportResizeCallback);
  }

  return {
    audioContext,
    resumeAudio,
    isStandalone: getStandaloneStatus(),
    onViewportResize: viewportResizeCallback,
    cleanup: () => {
      if (wakeLockSentinel) {
        wakeLockSentinel.release().catch(() => {});
        wakeLockSentinel = null;
      }
      viewportResizeCallback = undefined;
      if (audioContext) {
        audioContext.close();
        audioContext = null;
      }
    }
  };
};

export const getAudioContext = (): AudioContext | null => {
  if (!audioContext) {
    try {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (e) {
      console.warn('Failed to create audio context:', e);
    }
  }
  return audioContext;
};

export const isStandalone = (): boolean => {
  return getStandaloneStatus();
};

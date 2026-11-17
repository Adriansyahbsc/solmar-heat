// Synthesised sound, no audio files: a WebAudio graph built on the first user gesture
// (browsers block audio before one). Engine hum follows the driven car's speed, the
// siren wails while police are close, and short blips mark shots, pickups and missions.

export function createAudio() {
  let context = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenLfo = null;
  let muted = false;
  let started = false;

  function ensure() {
    if (started) return true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(context.destination);

      engineOsc = context.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = context.createGain();
      engineGain.gain.value = 0;
      const engineFilter = context.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();

      sirenOsc = context.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 780;
      sirenLfo = context.createOscillator();
      sirenLfo.type = 'square';
      sirenLfo.frequency.value = 0.9;
      const sirenDepth = context.createGain();
      sirenDepth.gain.value = 190;
      sirenLfo.connect(sirenDepth);
      sirenDepth.connect(sirenOsc.frequency);
      sirenGain = context.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      sirenLfo.start();

      started = true;
      return true;
    } catch {
      return false;
    }
  }

  /** Call from any user gesture: unlocks the audio context. */
  function unlock() {
    if (ensure() && context.state === 'suspended') context.resume().catch(() => {});
  }

  function blip(frequency, duration, type, volume, slideTo) {
    if (!ensure()) return;
    try {
      const osc = context.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(frequency, context.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), context.currentTime + duration);
      const gain = context.createGain();
      gain.gain.setValueAtTime(volume, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
      osc.connect(gain);
      gain.connect(master);
      osc.start();
      osc.stop(context.currentTime + duration + 0.02);
    } catch {
      // A failed blip is never worth breaking the game over.
    }
  }

  function noiseBurst(duration, volume, filterFreq) {
    if (!ensure()) return;
    try {
      const length = Math.max(1, Math.floor(context.sampleRate * duration));
      const buffer = context.createBuffer(1, length, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      const source = context.createBufferSource();
      source.buffer = buffer;
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = filterFreq;
      const gain = context.createGain();
      gain.gain.value = volume;
      source.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      source.start();
    } catch {
      // See blip().
    }
  }

  return {
    unlock,
    /** True while the player asked for silence. */
    isMuted() {
      return muted;
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    /** Continuous layers, called every frame: engine by speed, siren by police nearness. */
    update(driving, speedRatio, sirenNear) {
      if (!started || !context) return;
      const now = context.currentTime;
      engineGain.gain.setTargetAtTime(driving ? 0.05 + 0.09 * speedRatio : 0, now, 0.08);
      engineOsc.frequency.setTargetAtTime(52 + 130 * speedRatio, now, 0.08);
      sirenGain.gain.setTargetAtTime(sirenNear ? 0.045 : 0, now, 0.15);
    },
    shot() {
      noiseBurst(0.12, 0.5, 2600);
    },
    copShot() {
      noiseBurst(0.1, 0.22, 1800);
    },
    pickup() {
      blip(660, 0.12, 'sine', 0.35, 990);
    },
    cash() {
      blip(880, 0.09, 'sine', 0.3, 1320);
      setTimeout(() => blip(1174, 0.12, 'sine', 0.25, 1568), 70);
    },
    crash() {
      noiseBurst(0.25, 0.5, 700);
    },
    bust() {
      blip(220, 0.5, 'square', 0.2, 110);
    },
    missionStart() {
      [523, 659, 784].forEach((freq, index) => {
        setTimeout(() => blip(freq, 0.16, 'triangle', 0.3), index * 110);
      });
    },
    missionDone() {
      [523, 659, 784, 1046].forEach((freq, index) => {
        setTimeout(() => blip(freq, 0.2, 'triangle', 0.32), index * 120);
      });
    },
    missionFailed() {
      [392, 330, 262].forEach((freq, index) => {
        setTimeout(() => blip(freq, 0.22, 'sawtooth', 0.18), index * 140);
      });
    },
  };
}

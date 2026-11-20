// Synthesized sound only — WebAudio oscillators and noise, no audio files. Everything
// starts on the first user gesture (browsers block audio before that) and stays quiet
// until then. The radio is one looping original synthwave line, written as notes.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let radioTimer = null;
  let muted = false;
  let radioOn = true;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
      // Engine: a sawtooth whose pitch follows speed, through a low-pass.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      // Siren: two alternating tones.
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'square';
      sirenOsc.frequency.value = 720;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      return true;
    } catch {
      return false;
    }
  }

  function noiseBurst(duration, volume, filterFreq) {
    if (!ctx || muted) return;
    const len = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start();
  }

  function blip(freq, duration, volume, type = 'sine') {
    if (!ctx || muted) return;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  // Original synthwave loop: a bass line and a lead line, 8 bars, ~112 BPM.
  const BASS = [55, 55, 65.41, 49, 55, 55, 82.41, 73.42];
  const LEAD = [220, 261.63, 329.63, 261.63, 220, 196, 164.81, 220];
  let bar = 0;
  function radioStep() {
    if (!ctx || muted || !radioOn) return;
    const beat = 60 / 112 / 2; // eighth notes
    const now = ctx.currentTime + 0.05;
    for (let i = 0; i < 8; i++) {
      const t = now + i * beat;
      const bass = ctx.createOscillator();
      bass.type = 'triangle';
      bass.frequency.value = BASS[(bar * 8 + i) % BASS.length];
      const bg = ctx.createGain();
      bg.gain.setValueAtTime(0.0001, t);
      bg.gain.linearRampToValueAtTime(0.12, t + 0.02);
      bg.gain.exponentialRampToValueAtTime(0.001, t + beat * 0.95);
      bass.connect(bg); bg.connect(master);
      bass.start(t); bass.stop(t + beat);
      if (i % 2 === 0) {
        const lead = ctx.createOscillator();
        lead.type = 'square';
        lead.frequency.value = LEAD[(bar * 4 + i / 2) % LEAD.length] * 2;
        const lg = ctx.createGain();
        lg.gain.setValueAtTime(0.0001, t);
        lg.gain.linearRampToValueAtTime(0.035, t + 0.02);
        lg.gain.exponentialRampToValueAtTime(0.001, t + beat * 1.8);
        lead.connect(lg); lg.connect(master);
        lead.start(t); lead.stop(t + beat * 1.9);
      }
    }
    bar += 1;
  }

  return {
    /** Call from any user gesture; also starts the radio loop. */
    unlock() {
      if (!ensure()) return;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      if (!radioTimer) radioTimer = window.setInterval(radioStep, 8 * (60 / 112 / 2) * 1000);
    },
    setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.35; },
    toggleRadio() { radioOn = !radioOn; return radioOn; },
    /** speed01: 0..1 of top speed. Sets the engine hum; 0 silences it. */
    engine(speed01, on) {
      if (!ctx) return;
      const target = !on || muted ? 0 : 0.02 + speed01 * 0.09;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
      engineOsc.frequency.setTargetAtTime(55 + speed01 * 165, ctx.currentTime, 0.08);
    },
    /** wanted > 0 turns the siren on; its pitch wails while on. */
    siren(on, time) {
      if (!ctx) return;
      if (!on) { sirenGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1); return; }
      sirenGain.gain.setTargetAtTime(muted ? 0 : 0.03, ctx.currentTime, 0.1);
      sirenOsc.frequency.value = 720 + Math.sin(time * 4.5) * 180;
    },
    gunshot() { noiseBurst(0.14, 0.5, 2400); blip(140, 0.08, 0.25, 'square'); },
    enemyShot() { noiseBurst(0.1, 0.18, 1800); },
    hit() { blip(190, 0.07, 0.3, 'triangle'); },
    punch() { noiseBurst(0.08, 0.3, 900); },
    crash(intensity) { noiseBurst(0.25, Math.min(0.6, 0.2 + intensity * 0.4), 700); },
    pickup() { blip(660, 0.09, 0.25); setTimeout(() => blip(880, 0.12, 0.25), 90); },
    missionPass() {
      [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.18, 0.3), i * 110));
    },
    missionFail() { [330, 262, 196].forEach((f, i) => setTimeout(() => blip(f, 0.2, 0.25, 'sawtooth'), i * 130)); },
    click() { blip(880, 0.05, 0.18); },
    horn() { blip(370, 0.35, 0.2, 'square'); setTimeout(() => blip(466, 0.35, 0.2, 'square'), 10); },
    explosion() { noiseBurst(0.7, 0.7, 500); blip(60, 0.5, 0.4, 'sine'); },
    jump() { blip(300, 0.12, 0.15, 'sine'); },
  };
}

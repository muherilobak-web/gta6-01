// Vice Point — all sound is synthesized with WebAudio. No audio files,
// no network: oscillators and noise buffers only. One original synthwave
// loop runs as the radio while driving; gunshots, sirens, the engine hum,
// footsteps and UI clicks are short synth blips. Audio starts muted until
// the player clicks something (the browser's autoplay rule), via unlock().
export function makeAudio() {
  let context = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let radioNodes = null;
  let radioTimer = null;
  let unlocked = false;

  function ensureContext() {
    if (context) return context;
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return null;
    context = new AudioCtor();
    master = context.createGain();
    master.gain.value = 0.45;
    master.connect(context.destination);
    return context;
  }

  function unlock() {
    const ctx = ensureContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    unlocked = true;
    startRadio();
  }

  function blip(freq, duration, type, volume, slideTo) {
    if (!unlocked || !context) return;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, context.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, context.currentTime + duration);
    gain.gain.setValueAtTime(volume || 0.2, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    osc.stop(context.currentTime + duration + 0.02);
  }

  function noiseBurst(duration, volume, filterFreq) {
    if (!unlocked || !context) return;
    const length = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq || 1200;
    const gain = context.createGain();
    gain.gain.value = volume || 0.3;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start();
  }

  // The radio: a slow synthwave loop in A minor, played note by note on a
  // timer so it never needs a file. Bass, pad and a simple lead arpeggio.
  function startRadio() {
    if (radioNodes || !context) return;
    radioNodes = true;
    const bassNotes = [55, 55, 65.4, 49, 55, 55, 82.4, 73.4];
    const leadNotes = [220, 261.6, 329.6, 440, 329.6, 261.6, 220, 196];
    let step = 0;
    radioTimer = window.setInterval(() => {
      if (!unlocked || document.hidden) return;
      const bass = bassNotes[step % bassNotes.length];
      const lead = leadNotes[step % leadNotes.length];
      blip(bass, 0.42, 'triangle', 0.16);
      if (step % 2 === 0) blip(lead, 0.3, 'square', 0.045);
      if (step % 4 === 0) blip(bass * 2, 0.5, 'sine', 0.05);
      step += 1;
    }, 240);
  }

  function engine(level, running) {
    if (!unlocked || !context) return;
    if (!engineOsc) {
      engineOsc = context.createOscillator();
      engineOsc.type = 'sawtooth';
      engineGain = context.createGain();
      engineGain.gain.value = 0;
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      engineOsc.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
    }
    const target = running ? 0.04 + level * 0.09 : 0;
    engineGain.gain.setTargetAtTime(target, context.currentTime, 0.08);
    engineOsc.frequency.setTargetAtTime(55 + level * 130, context.currentTime, 0.08);
  }

  function siren(active, time) {
    if (!unlocked || !context) return;
    if (!sirenOsc) {
      sirenOsc = context.createOscillator();
      sirenOsc.type = 'sine';
      sirenGain = context.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
    }
    sirenGain.gain.setTargetAtTime(active ? 0.035 : 0, context.currentTime, 0.15);
    if (active) {
      sirenOsc.frequency.setTargetAtTime(
        Math.sin(time * 5) > 0 ? 740 : 560, context.currentTime, 0.05,
      );
    }
  }

  return {
    unlock,
    click() { blip(660, 0.07, 'square', 0.12); },
    pickup() { blip(520, 0.12, 'sine', 0.2, 880); },
    jump() { blip(300, 0.15, 'sine', 0.12, 520); },
    punch() { noiseBurst(0.08, 0.3, 500); },
    gunshot() { noiseBurst(0.14, 0.5, 2600); blip(160, 0.1, 'square', 0.2, 60); },
    enemyShot() { noiseBurst(0.1, 0.16, 1800); },
    hit() { blip(900, 0.06, 'square', 0.14, 700); },
    crash(strength) { noiseBurst(0.3, 0.25 + 0.35 * strength, 700); },
    explosion() { noiseBurst(0.8, 0.6, 400); blip(70, 0.7, 'sine', 0.4, 30); },
    horn() { blip(370, 0.25, 'square', 0.12); blip(440, 0.25, 'square', 0.1); },
    missionPass() { [523, 659, 784].forEach((f, i) => window.setTimeout(() => blip(f, 0.18, 'triangle', 0.18), i * 110)); },
    missionFail() { [392, 330, 262].forEach((f, i) => window.setTimeout(() => blip(f, 0.22, 'triangle', 0.16), i * 130)); },
    engine,
    siren,
    stopRadio() {
      if (radioTimer) window.clearInterval(radioTimer);
      radioTimer = null;
      radioNodes = null;
    },
  };
}

// Synthesized sound only — WebAudio oscillators and filtered noise, no
// audio files. Engine hum, sirens, gunshots, footsteps, UI clicks and one
// looping original synthwave radio track.

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenOn = false;
    this.radioTimer = null;
    this.radioStep = 0;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
      this._startEngine();
      return true;
    } catch (e) {
      return false;
    }
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }

  _startEngine() {
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 320;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0.0;
    this.engineOsc.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();
  }

  setEngine(speedNorm, driving) {
    if (!this.engineOsc) return;
    const t = this.ctx.currentTime;
    this.engineOsc.frequency.setTargetAtTime(48 + speedNorm * 130, t, 0.08);
    this.engineGain.gain.setTargetAtTime(driving ? 0.05 + speedNorm * 0.06 : 0.02, t, 0.1);
  }

  _noiseBurst(duration, filterFreq, volume) {
    if (!this.ctx) return;
    const len = Math.floor(this.ctx.sampleRate * duration);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = this.ctx.createGain();
    gain.gain.value = volume;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start();
  }

  _tone(freq, duration, type, volume, slideTo) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, this.ctx.currentTime + duration);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start();
    osc.stop(this.ctx.currentTime + duration + 0.02);
  }

  gunshot(big) {
    this._noiseBurst(big ? 0.28 : 0.14, big ? 900 : 1800, big ? 0.5 : 0.32);
    this._tone(big ? 90 : 140, 0.12, 'square', 0.12, 45);
  }

  hit() {
    this._tone(220, 0.07, 'triangle', 0.15, 180);
  }

  footstep() {
    this._noiseBurst(0.05, 500, 0.06);
  }

  click() {
    this._tone(660, 0.06, 'sine', 0.12);
  }

  pickup() {
    this._tone(520, 0.09, 'sine', 0.16, 780);
    this._tone(780, 0.12, 'sine', 0.12, 1040);
  }

  missionPass() {
    const notes = [523, 659, 784, 1046];
    notes.forEach((f, i) => {
      setTimeout(() => this._tone(f, 0.22, 'triangle', 0.16), i * 110);
    });
  }

  missionFail() {
    const notes = [392, 330, 262];
    notes.forEach((f, i) => {
      setTimeout(() => this._tone(f, 0.25, 'sawtooth', 0.1), i * 140);
    });
  }

  crash() {
    this._noiseBurst(0.4, 700, 0.4);
    this._tone(70, 0.3, 'sine', 0.25, 35);
  }

  setSiren(on) {
    if (!this.ctx) return;
    if (on === this.sirenOn) return;
    this.sirenOn = on;
    if (on) {
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'triangle';
      this.sirenOsc.frequency.value = 700;
      const lfo = this.ctx.createOscillator();
      lfo.type = 'square';
      lfo.frequency.value = 1.4;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 260;
      lfo.connect(lfoGain);
      lfoGain.connect(this.sirenOsc.frequency);
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0.045;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.master);
      this.sirenOsc.start();
      lfo.start();
      this._sirenLfo = lfo;
    } else if (this.sirenOsc) {
      try {
        this.sirenOsc.stop();
        this._sirenLfo.stop();
      } catch (e) {
        /* already stopped */
      }
      this.sirenOsc = null;
      this.sirenGain = null;
    }
  }

  // One looping original synthwave line: a slow minor arpeggio.
  startRadio() {
    if (!this.ctx || this.radioTimer) return;
    const seq = [110, 130.8, 164.8, 196, 164.8, 130.8];
    this.radioTimer = setInterval(() => {
      if (this.muted) return;
      const f = seq[this.radioStep % seq.length];
      this._tone(f, 0.5, 'sawtooth', 0.035);
      this._tone(f * 2, 0.4, 'sine', 0.02);
      this.radioStep++;
    }, 320);
  }

  stopRadio() {
    if (this.radioTimer) {
      clearInterval(this.radioTimer);
      this.radioTimer = null;
    }
  }
}

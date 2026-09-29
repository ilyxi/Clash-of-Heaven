'use strict';
// ---------------------------------------------------------------------------
// Synthesized sound effects + procedural music (WebAudio, no assets).
// ---------------------------------------------------------------------------

const SFX = (() => {
  let ac = null, master = null, sfxBus = null, musicBus = null, noiseBuf = null;
  const last = {};
  let voices = 0;
  const settings = { sfx: 0.7, music: 0.45, muted: false };

  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    master = ac.createGain();
    master.connect(ac.destination);
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    comp.connect(master);
    sfxBus = ac.createGain(); sfxBus.connect(comp);
    musicBus = ac.createGain(); musicBus.connect(comp);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    applyVolumes();
  }

  function applyVolumes() {
    if (!ac) return;
    master.gain.value = settings.muted ? 0 : 1;
    sfxBus.gain.value = settings.sfx;
    musicBus.gain.value = settings.music * 0.55;
  }

  function out(pan, bus) {
    let node = bus || sfxBus;
    if (pan && ac.createStereoPanner) {
      const p = ac.createStereoPanner();
      p.pan.value = U.clamp(pan, -1, 1);
      p.connect(node);
      node = p;
    }
    return node;
  }

  function env(g, t, vol, attack, dur) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }

  function tone(o) {
    const t = ac.currentTime + (o.delay || 0);
    const osc = ac.createOscillator();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(o.freq, t);
    if (o.freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.freqEnd), t + o.dur);
    if (o.detune) osc.detune.value = o.detune;
    const g = ac.createGain();
    env(g, t, o.vol || 0.2, o.attack || 0.005, o.dur);
    osc.connect(g); g.connect(out(o.pan, o.bus));
    osc.start(t); osc.stop(t + o.dur + 0.05);
    voices++; osc.onended = () => voices--;
  }

  function noise(o) {
    const t = ac.currentTime + (o.delay || 0);
    const src = ac.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const f = ac.createBiquadFilter();
    f.type = o.filter || 'lowpass';
    f.frequency.setValueAtTime(o.freq || 1000, t);
    if (o.freqEnd) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.freqEnd), t + o.dur);
    f.Q.value = o.q || 0.8;
    const g = ac.createGain();
    env(g, t, o.vol || 0.2, o.attack || 0.005, o.dur);
    src.connect(f); f.connect(g); g.connect(out(o.pan, o.bus));
    src.start(t, Math.random() * 0.5); src.stop(t + o.dur + 0.05);
    voices++; src.onended = () => voices--;
  }

  const P = {
    swing: (v, p) => noise({ filter: 'bandpass', freq: 900, freqEnd: 3200, dur: 0.09, vol: 0.18 * v, q: 1.2, pan: p }),
    hit: (v, p) => { tone({ type: 'square', freq: 190, freqEnd: 55, dur: 0.08, vol: 0.16 * v, pan: p }); noise({ freq: 2400, freqEnd: 500, dur: 0.07, vol: 0.3 * v, pan: p }); },
    hitHeavy: (v, p) => { tone({ type: 'sine', freq: 140, freqEnd: 35, dur: 0.22, vol: 0.45 * v, pan: p }); noise({ freq: 1600, freqEnd: 200, dur: 0.18, vol: 0.4 * v, pan: p }); },
    block: (v, p) => { tone({ type: 'triangle', freq: 520, freqEnd: 380, dur: 0.06, vol: 0.2 * v, pan: p }); noise({ filter: 'highpass', freq: 2500, dur: 0.05, vol: 0.12 * v, pan: p }); },
    parry: (v, p) => { tone({ type: 'sine', freq: 1500, dur: 0.35, vol: 0.22 * v, pan: p }); tone({ type: 'sine', freq: 2250, dur: 0.25, vol: 0.12 * v, pan: p }); tone({ type: 'square', freq: 3000, dur: 0.05, vol: 0.06 * v, pan: p }); },
    guardBreak: (v, p) => { tone({ type: 'sawtooth', freq: 300, freqEnd: 80, dur: 0.3, vol: 0.2 * v, pan: p }); noise({ freq: 3000, freqEnd: 300, dur: 0.25, vol: 0.3 * v, pan: p }); },
    dash: (v, p) => noise({ filter: 'bandpass', freq: 700, freqEnd: 2600, dur: 0.13, vol: 0.14 * v, q: 1.5, pan: p }),
    kunai: (v, p) => { noise({ filter: 'highpass', freq: 3500, dur: 0.05, vol: 0.1 * v, pan: p }); tone({ type: 'triangle', freq: 1900, freqEnd: 900, dur: 0.07, vol: 0.06 * v, pan: p }); },
    clink: (v, p) => { tone({ type: 'square', freq: 2600, dur: 0.05, vol: 0.08 * v, pan: p }); tone({ type: 'sine', freq: 3400, dur: 0.12, vol: 0.08 * v, pan: p }); },
    fire: (v, p) => { noise({ freq: 1400, freqEnd: 300, dur: 0.4, vol: 0.28 * v, attack: 0.03, pan: p }); tone({ type: 'sawtooth', freq: 90, freqEnd: 50, dur: 0.25, vol: 0.05 * v, pan: p }); },
    fireBig: (v, p) => { noise({ freq: 900, freqEnd: 120, dur: 0.9, vol: 0.4 * v, attack: 0.05, pan: p }); tone({ type: 'sine', freq: 90, freqEnd: 35, dur: 0.7, vol: 0.3 * v, pan: p }); },
    water: (v, p) => { noise({ filter: 'bandpass', freq: 500, freqEnd: 1600, dur: 0.35, vol: 0.28 * v, q: 2.5, attack: 0.02, pan: p }); tone({ type: 'sine', freq: 350, freqEnd: 900, dur: 0.12, vol: 0.08 * v, pan: p, delay: 0.05 }); },
    splash: (v, p) => { noise({ filter: 'bandpass', freq: 1400, freqEnd: 400, dur: 0.25, vol: 0.25 * v, q: 1.5, pan: p }); },
    earth: (v, p) => { noise({ freq: 400, freqEnd: 90, dur: 0.45, vol: 0.4 * v, attack: 0.01, pan: p }); tone({ type: 'sine', freq: 70, freqEnd: 30, dur: 0.4, vol: 0.35 * v, pan: p }); },
    wind: (v, p) => noise({ filter: 'bandpass', freq: 350, freqEnd: 2000, dur: 0.45, vol: 0.3 * v, q: 1, attack: 0.06, pan: p }),
    lightning: (v, p) => {
      noise({ filter: 'highpass', freq: 1800, dur: 0.25, vol: 0.25 * v, pan: p });
      for (let i = 0; i < 4; i++) tone({ type: 'square', freq: U.rand(80, 400), dur: 0.03, vol: 0.08 * v, delay: i * 0.035, pan: p });
    },
    thunder: (v, p) => { noise({ freq: 2500, freqEnd: 90, dur: 1.2, vol: 0.5 * v, pan: p }); P.lightning(v, p); },
    explosion: (v, p) => { noise({ freq: 1000, freqEnd: 70, dur: 0.9, vol: 0.55 * v, pan: p }); tone({ type: 'sine', freq: 100, freqEnd: 28, dur: 0.7, vol: 0.45 * v, pan: p }); },
    poof: (v, p) => noise({ filter: 'bandpass', freq: 1200, freqEnd: 500, dur: 0.18, vol: 0.2 * v, q: 0.7, pan: p }),
    seal: (v, p) => { tone({ type: 'triangle', freq: 1100, dur: 0.03, vol: 0.07 * v, pan: p }); tone({ type: 'triangle', freq: 1300, dur: 0.03, vol: 0.07 * v, delay: 0.06, pan: p }); },
    charge: (v, p) => { tone({ type: 'sine', freq: 180, freqEnd: 360, dur: 0.35, vol: 0.08 * v, attack: 0.1, pan: p }); noise({ filter: 'bandpass', freq: 600, dur: 0.35, vol: 0.05 * v, attack: 0.1, pan: p }); },
    levelup: (v) => { [523, 659, 784, 1046].forEach((f, i) => tone({ type: 'square', freq: f, dur: 0.12, vol: 0.09 * v, delay: i * 0.07 })); },
    mastery: (v) => { [392, 523, 659, 784, 1046, 1318].forEach((f, i) => tone({ type: 'triangle', freq: f, dur: 0.18, vol: 0.12 * v, delay: i * 0.06 })); },
    awaken: (v, p) => { tone({ type: 'sawtooth', freq: 70, freqEnd: 420, dur: 1.0, vol: 0.14 * v, attack: 0.1, pan: p }); noise({ freq: 400, freqEnd: 4000, dur: 0.9, vol: 0.25 * v, attack: 0.2, pan: p }); tone({ type: 'sine', freq: 55, dur: 1.0, vol: 0.3 * v, pan: p }); },
    ult: (v) => { tone({ type: 'sawtooth', freq: 55, dur: 1.2, vol: 0.14 * v, attack: 0.3 }); tone({ type: 'sawtooth', freq: 82.5, dur: 1.2, vol: 0.1 * v, attack: 0.3 }); noise({ freq: 200, freqEnd: 3000, dur: 1.1, vol: 0.25 * v, attack: 0.8 }); },
    ui: (v) => tone({ type: 'square', freq: 880, dur: 0.04, vol: 0.06 * v }),
    uiOk: (v) => { tone({ type: 'square', freq: 660, dur: 0.05, vol: 0.06 * v }); tone({ type: 'square', freq: 990, dur: 0.07, vol: 0.06 * v, delay: 0.05 }); },
    uiBack: (v) => tone({ type: 'square', freq: 440, freqEnd: 330, dur: 0.07, vol: 0.06 * v }),
    ko: (v, p) => { tone({ type: 'sawtooth', freq: 320, freqEnd: 50, dur: 0.6, vol: 0.18 * v, pan: p }); noise({ freq: 1800, freqEnd: 200, dur: 0.5, vol: 0.3 * v, pan: p }); },
    crumble: (v, p) => { noise({ freq: 700, freqEnd: 150, dur: 0.5, vol: 0.35 * v, pan: p }); for (let i = 0; i < 3; i++) tone({ type: 'sine', freq: U.rand(60, 110), freqEnd: 30, dur: 0.12, vol: 0.2 * v, delay: i * 0.07, pan: p }); },
    wood: (v, p) => { noise({ filter: 'bandpass', freq: 450, dur: 0.12, vol: 0.2 * v, q: 2, pan: p }); tone({ type: 'triangle', freq: 170, freqEnd: 120, dur: 0.1, vol: 0.15 * v, pan: p }); },
    sub: (v, p) => { P.poof(v, p); tone({ type: 'square', freq: 900, freqEnd: 1800, dur: 0.08, vol: 0.06 * v, pan: p }); },
    whip: (v, p) => noise({ filter: 'bandpass', freq: 2000, freqEnd: 600, dur: 0.15, vol: 0.25 * v, q: 3, pan: p }),
    beam: (v, p) => { tone({ type: 'sawtooth', freq: 120, dur: 1.0, vol: 0.12 * v, attack: 0.05, pan: p }); noise({ freq: 3000, freqEnd: 600, dur: 1.0, vol: 0.3 * v, pan: p }); },
    burn: (v, p) => noise({ freq: 700, dur: 0.12, vol: 0.06 * v, pan: p }),
    tick: (v) => tone({ type: 'square', freq: 1200, dur: 0.03, vol: 0.05 * v }),
    horn: (v) => { tone({ type: 'sawtooth', freq: 220, dur: 0.7, vol: 0.1 * v, attack: 0.05 }); tone({ type: 'sawtooth', freq: 330, dur: 0.7, vol: 0.08 * v, attack: 0.05 }); },
  };

  // listener position used for positional attenuation
  const listener = { x: 0, y: 0 };

  function play(name, vol = 1, pan = 0) {
    if (!ac || settings.muted || !P[name]) return;
    const now = ac.currentTime;
    if (last[name] && now - last[name] < 0.035) return;
    if (voices > 48) return;
    last[name] = now;
    try { P[name](vol, pan); } catch (e) { /* audio errors never break gameplay */ }
  }

  function playAt(name, x, y, vol = 1) {
    const d = U.dist(listener.x, listener.y, x, y);
    if (d > 26) return;
    const att = d < 6 ? 1 : Math.max(0, 1 - (d - 6) / 20);
    const pan = U.clamp(((x - y) - (listener.x - listener.y)) / 18, -0.8, 0.8);
    play(name, vol * att, pan);
  }

  // ---- procedural music -----------------------------------------------------
  const Music = (() => {
    const IN_SCALE = [0, 1, 5, 7, 8]; // Japanese "In" scale
    let timer = null, step = 0, nextTime = 0, track = null, song = null;

    function midi(m) { return 440 * Math.pow(2, (m - 69) / 12); }
    function deg(root, d) {
      const oct = Math.floor(d / 5), i = ((d % 5) + 5) % 5;
      return root + oct * 12 + IN_SCALE[i];
    }

    function compose(seed, battle) {
      const r = U.rng(seed);
      const bars = [];
      const motifs = [];
      for (let m = 0; m < 2; m++) {
        const notes = [];
        let d = r.int(4, 7);
        for (let s = 0; s < 16; s++) {
          if (s % 2 === 1 && r.chance(0.55)) { notes.push(null); continue; }
          if (r.chance(battle ? 0.2 : 0.35)) { notes.push(null); continue; }
          d += r.pick([-2, -1, -1, 0, 1, 1, 2]);
          d = U.clamp(d, 2, 10);
          notes.push({ d, len: r.pick([1, 2, 2, 3]) });
        }
        motifs.push(notes);
      }
      const form = [0, 0, 1, 0, 0, 1, 1, 0];
      for (const f of form) bars.push(motifs[f]);
      const bass = battle ? [0, 0, -2, -1, 0, 0, -2, 1] : [0, -2, -1, 0, 0, -2, -1, -3];
      return { bars, bass, bpm: battle ? 138 : 84, root: battle ? 50 : 52, battle };
    }

    function schedule() {
      if (!ac || !song) return;
      const spb = 60 / song.bpm / 4; // 16th notes
      while (nextTime < ac.currentTime + 0.15) {
        playStep(step, nextTime, spb);
        nextTime += spb;
        step++;
      }
    }

    function voice(type, freq, t, dur, vol, attack = 0.01, vib = 0) {
      const osc = ac.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      if (vib) {
        const lfo = ac.createOscillator(); const lg = ac.createGain();
        lfo.frequency.value = 5.5; lg.gain.value = freq * vib;
        lfo.connect(lg); lg.connect(osc.frequency);
        lfo.start(t); lfo.stop(t + dur + 0.05);
      }
      osc.connect(g); g.connect(musicBus);
      osc.start(t); osc.stop(t + dur + 0.05);
    }
    function drum(t, freq, dur, vol, noiseVol, nf) {
      voice('sine', freq, t, dur, vol, 0.002);
      if (noiseVol) {
        const src = ac.createBufferSource(); src.buffer = noiseBuf;
        const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = nf || 3000; f.Q.value = 0.9;
        const g = ac.createGain();
        g.gain.setValueAtTime(noiseVol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.6);
        src.connect(f); f.connect(g); g.connect(musicBus);
        src.start(t, Math.random() * 0.5); src.stop(t + dur);
      }
    }

    function playStep(s, t, spb) {
      const bar = Math.floor(s / 16) % song.bars.length;
      const i = s % 16;
      const notes = song.bars[bar];
      const n = notes[i];
      if (n) {
        const f = midi(deg(song.root + 12, n.d));
        if (song.battle) {
          voice('square', f, t, spb * n.len * 1.1, 0.045, 0.005);
          voice('triangle', f * 2, t, spb * n.len, 0.02, 0.005);
        } else {
          voice('triangle', f, t, spb * n.len * 2.2, 0.08, 0.004); // koto-like pluck
          voice('sine', f * 2, t, spb * 1.5, 0.02, 0.004);
        }
      }
      // bass
      const b = song.bass[bar];
      if (song.battle) {
        if (i % 4 === 0 || i === 6 || i === 14) voice('triangle', midi(deg(song.root - 12, b)), t, spb * 1.8, 0.12, 0.005);
      } else if (i === 0 || i === 8) {
        voice('triangle', midi(deg(song.root - 12, b)), t, spb * 7, 0.09, 0.02);
      }
      // drums
      if (song.battle) {
        if (i === 0 || i === 3 || i === 8 || i === 10) drum(t, 62, 0.3, 0.35, 0.06, 200); // taiko
        if (i === 4 || i === 12) drum(t, 180, 0.12, 0.08, 0.14, 2500); // rim
        if (i % 2 === 1) drum(t, 0.1, 0.05, 0.0001, 0.03, 8000); // shaker
      } else {
        if (i === 0) drum(t, 70, 0.4, 0.18, 0.02, 300);
        if (i === 10) drum(t, 90, 0.2, 0.08, 0.01, 300);
      }
    }

    function start(which) {
      if (!ac) return;
      if (track === which && timer) return;
      stop();
      track = which;
      song = compose(which === 'battle' ? 1337 + U.randi(0, 5) : 777, which === 'battle');
      step = 0; nextTime = ac.currentTime + 0.1;
      timer = setInterval(schedule, 30);
    }
    function stop() { if (timer) clearInterval(timer); timer = null; track = null; }
    return { start, stop, get track() { return track; } };
  })();

  return {
    init, play, playAt, listener, settings, applyVolumes, Music,
    get ready() { return !!ac; },
  };
})();

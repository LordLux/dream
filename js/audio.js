// Dream — tiny Web Audio synth for sound effects (no audio files needed).
(function (root) {
  const D = (root.Dream = root.Dream || {});
  let ctx = null;
  let muted = false;
  try { muted = localStorage.getItem('dream-muted') === '1'; } catch (e) { /* storage blocked */ }

  function ac() {
    if (!ctx) {
      const AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // One enveloped oscillator note. `to` glides the pitch.
  function note(freq, start, dur, type, vol, to) {
    const a = ac();
    if (!a) return;
    const t = a.currentTime + start;
    const osc = a.createOscillator();
    const gain = a.createGain();
    osc.type = type || 'triangle';
    osc.frequency.setValueAtTime(freq, t);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol || 0.12, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(a.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  const sounds = {
    select: () => note(660, 0, 0.08, 'square', 0.05),
    draw: () => { note(392, 0, 0.09, 'triangle', 0.12); note(523, 0.07, 0.12, 'triangle', 0.12); },
    place: () => { note(523, 0, 0.1, 'triangle', 0.13); note(784, 0.08, 0.18, 'triangle', 0.12); },
    swap: () => [659, 784, 988, 1319].forEach((f, i) => note(f, i * 0.07, 0.2, 'sine', 0.12)),
    steal: () => { note(330, 0, 0.3, 'sawtooth', 0.07, 110); note(165, 0.05, 0.35, 'square', 0.05, 82); },
    shuffle: () => { for (let i = 0; i < 14; i++) note(700 + Math.random() * 700, i * 0.07, 0.03, 'square', 0.022); },
    deal: () => note(720, 0, 0.06, 'triangle', 0.07, 400),
    discard: () => note(260, 0, 0.16, 'triangle', 0.1, 150),
    error: () => { note(180, 0, 0.1, 'square', 0.06); note(150, 0.1, 0.14, 'square', 0.06); },
    turn: () => note(880, 0, 0.12, 'sine', 0.07),
    win: () => [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => note(f, i * 0.12, 0.3, 'triangle', 0.13)),
    lose: () => [392, 349, 311, 262].forEach((f, i) => note(f, i * 0.18, 0.34, 'triangle', 0.11)),
  };

  D.Sfx = {
    play(name) {
      if (muted || !sounds[name]) return;
      try { sounds[name](); } catch (e) { /* audio is optional */ }
    },
    get muted() { return muted; },
    toggle() {
      muted = !muted;
      try { localStorage.setItem('dream-muted', muted ? '1' : '0'); } catch (e) { /* storage blocked */ }
      return muted;
    },
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);

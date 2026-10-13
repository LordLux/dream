// Dream — built-in SVG card illustrations + loader for custom PNGs in ./assets/.
// Every illustration is drawn on a 100x140 canvas that fills the whole card.
(function (root) {
  const D = (root.Dream = root.Dream || {});

  // ---------- small drawing helpers ----------
  // Gradients and masks are defined once in a shared, always-rendered <svg> (see bottom of file):
  // ids duplicated inside each card stop resolving as soon as the first copy sits in a hidden screen.
  let sharedDefs = '';
  const sky = (id, a, b) => {
    sharedDefs += `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
    return `<rect width="100" height="140" fill="url(#${id})"/>`;
  };
  const cloud = (x, y, s, f = '#fff', o = 1) =>
    `<g transform="translate(${x} ${y}) scale(${s})" fill="${f}" opacity="${o}"><circle cx="0" cy="0" r="9"/><circle cx="12" cy="-6" r="12"/><circle cx="26" cy="0" r="9"/><rect x="-4" y="0" width="34" height="9" rx="4.5"/></g>`;
  const eyes = (x, y, d = 8, c = '#4a3b5c', r = 1.6) =>
    `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/><circle cx="${x + d}" cy="${y}" r="${r}" fill="${c}"/>`;
  const arc = (x, y, w, c, up = false, sw = 1.4) =>
    `<path d="M${x} ${y} q${w / 2} ${up ? -w / 2 : w / 2} ${w} 0" stroke="${c}" stroke-width="${sw}" fill="none" stroke-linecap="round"/>`;
  const sleepy = (x, y, d = 8, c = '#4a3b5c') => arc(x - 2, y, 4, c) + arc(x + d - 2, y, 4, c);
  const blush = (x, y, d = 12, r = 2) =>
    `<circle cx="${x}" cy="${y}" r="${r}" fill="#ff8fa3" opacity=".6"/><circle cx="${x + d}" cy="${y}" r="${r}" fill="#ff8fa3" opacity=".6"/>`;
  // chunky pixel sparkle
  const spark = (x, y, c = '#fff', s = 1.6) =>
    `<g fill="${c}"><rect x="${x - s / 2}" y="${y - s * 1.5}" width="${s}" height="${s * 3}"/><rect x="${x - s * 1.5}" y="${y - s / 2}" width="${s * 3}" height="${s}"/></g>`;
  const px = (x, y, c = '#fff', s = 1.6, o = 1) => `<rect x="${x}" y="${y}" width="${s}" height="${s}" fill="${c}" opacity="${o}"/>`;
  // two chasing arrows — the Jolly "cycle" mark
  function cycle(cx, cy, r, c, w) {
    const ex = cx + 0.94 * r, ey = cy - 0.34 * r, h = 0.5 * r, k = 0.3 * r;
    const half = `<path d="M${cx - 0.94 * r} ${ey} A${r} ${r} 0 0 1 ${ex} ${ey}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round"/>` +
      `<path d="M${ex + 0.34 * h} ${ey + 0.94 * h} L${ex + 0.94 * k} ${ey - 0.34 * k} L${ex - 0.94 * k} ${ey + 0.34 * k}Z" fill="${c}"/>`;
    return `<g>${half}<g transform="rotate(180 ${cx} ${cy})">${half}</g></g>`;
  }

  const DREAM_SKY = sky('g-dream', '#fff0cf', '#ffc58a');
  const NIGHT_SKY = sky('g-night', '#2b1d57', '#5a3d9a');
  const REM_SKY = sky('g-rem', '#d9f2c4', '#8fcf9b');
  const dreamDust = spark(16, 36, '#fff') + spark(84, 46, '#fff') + px(26, 52, '#fff') + px(74, 30, '#fff') + px(88, 70, '#fff', 1.6, 0.8);
  const nightDust = px(14, 34, '#d9c7ff') + px(86, 40, '#d9c7ff') + px(24, 58, '#d9c7ff', 1.6, 0.6) + px(78, 62, '#d9c7ff', 1.6, 0.6) + spark(90, 100, '#b79cf2', 1.3) + spark(10, 96, '#b79cf2', 1.3);

  // ---------- Dream fronts ----------
  const catFlower = (x, y) => {
    let petals = '';
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI * 2 * i) / 6 + 0.5;
      petals += `<circle cx="${(x + Math.cos(a) * 9).toFixed(1)}" cy="${(y + Math.sin(a) * 9).toFixed(1)}" r="6" fill="#ffc266"/>`;
    }
    return `<path d="M${x} ${y + 8} Q${x + 4} ${y + 30} ${x} 132" stroke="#6faf5d" stroke-width="2.4" fill="none"/>` +
      `<ellipse cx="${x + 7}" cy="${y + 30}" rx="6" ry="2.6" fill="#84c46f" transform="rotate(-25 ${x + 7} ${y + 30})"/>` + petals +
      `<path d="M${x - 8} ${y - 3} L${x - 7} ${y - 12} L${x - 1} ${y - 7}Z M${x + 8} ${y - 3} L${x + 7} ${y - 12} L${x + 1} ${y - 7}Z" fill="#ff9a3c"/>` +
      `<circle cx="${x}" cy="${y}" r="8.5" fill="#ff9a3c"/>` + eyes(x - 3.5, y - 1, 7, '#5a3418', 1.3) +
      `<path d="M${x - 1} ${y + 2} h2 l-1 1.4z" fill="#5a3418"/>` + arc(x - 3, y + 3.6, 3, '#5a3418', false, 0.9) + arc(x, y + 3.6, 3, '#5a3418', false, 0.9);
  };
  const squirrelFish = (x, y, r) =>
    `<g transform="translate(${x} ${y}) rotate(${r})"><circle cx="-10" cy="-3" r="5" fill="#f2a05a"/><circle cx="-9" cy="-4" r="2.4" fill="#ffd9a8"/>` +
    `<ellipse cx="0" cy="0" rx="8" ry="4.6" fill="#ff9a4d"/><path d="M-1 -4 q3 -7 7 -3z" fill="#bfe6ff"/><circle cx="4.5" cy="-1" r="1.1" fill="#4a3b5c"/></g>`;
  const sheep = (x, y, s) =>
    `<g transform="translate(${x} ${y}) scale(${s})">${cloud(0, 0, 1, '#fff')}<rect x="4" y="8" width="2.4" height="6" fill="#6b5a80"/><rect x="18" y="8" width="2.4" height="6" fill="#6b5a80"/>` +
    `<ellipse cx="-7" cy="0" rx="6" ry="6.6" fill="#6b5a80"/><ellipse cx="-12" cy="-4" rx="3" ry="1.6" fill="#6b5a80" transform="rotate(-30 -12 -4)"/>` +
    arc(-10.5, 0, 2.6, '#fff', false, 1) + arc(-6, 0, 2.6, '#fff', false, 1) + `</g>`;
  const bunny = (x, y, r = 0) =>
    `<g transform="translate(${x} ${y}) rotate(${r})"><ellipse cx="-5" cy="-3" rx="5" ry="2.6" fill="#cfeaff" transform="rotate(-30 -5 -3)"/><ellipse cx="5" cy="-3" rx="5" ry="2.6" fill="#cfeaff" transform="rotate(30 5 -3)"/>` +
    `<ellipse cx="0" cy="2" rx="5.5" ry="4.5" fill="#fff"/><ellipse cx="-2" cy="-6" rx="1.5" ry="4" fill="#fff"/><ellipse cx="2" cy="-6" rx="1.5" ry="4" fill="#fff"/>` +
    eyes(-2, 1.5, 4, '#4a3b5c', 0.8) + `</g>`;
  const balloon = (x, y, s, a, b) =>
    `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-14 0 a14 15 0 1 1 28 0 q0 9 -9 18 h-10 q-9 -9 -9 -18z" fill="${a}"/>` +
    `<path d="M-5 -14 q-6 14 0 32 h10 q6 -18 0 -32 q-5 -2 -10 0z" fill="${b}"/><path d="M-5 18 l1 7 M5 18 l-1 7" stroke="#8a6a4a" stroke-width="1"/>` +
    `<rect x="-5" y="25" width="10" height="7" rx="1.5" fill="#b9854f"/></g>`;

  const fronts = {
    // mushroom-hat creature reading on a fluffy eyed cloud
    dream_1: () => DREAM_SKY + dreamDust + cloud(26, 106, 1.9) + eyes(42, 110, 16, '#4a3b5c', 1.8) + arc(46, 114, 8, '#4a3b5c') + blush(37, 114, 26, 2.4) +
      `<ellipse cx="50" cy="82" rx="11" ry="12" fill="#fff3da"/><path d="M27 72 Q50 30 73 72 Q50 78 27 72Z" fill="#ff7b5a"/>` +
      `<circle cx="41" cy="60" r="3.2" fill="#fff"/><circle cx="55" cy="52" r="3.8" fill="#fff"/><circle cx="62" cy="64" r="2.6" fill="#fff"/>` +
      sleepy(46, 80, 8) + blush(43, 83, 14, 1.8) + `<path d="M39 87 l11 3 l11 -3 v8 l-11 3 l-11 -3z" fill="#7fb7e6"/><path d="M50 90 v8" stroke="#4f86b8" stroke-width="1"/>`,
    // blooming orange cat-flowers
    dream_2: () => DREAM_SKY + dreamDust + catFlower(26, 86) + catFlower(74, 90) + catFlower(50, 62),
    // girl on a cloud catching flying squirrel-fish with a net
    dream_3: () => DREAM_SKY + dreamDust + cloud(14, 112, 1.7) +
      `<path d="M26 108 L36 84 L46 108Z" fill="#ff9fb5"/><path d="M40 92 L64 62" stroke="#8a5a3c" stroke-width="1.8" stroke-linecap="round"/>` +
      `<circle cx="36" cy="78" r="7.5" fill="#ffe0c2"/><path d="M28.5 79 a7.5 7.5 0 0 1 15 -2 q-8 -4 -13 2 l-1 9 q-2 -4 -1 -9z" fill="#8a5a3c"/>` + eyes(35, 79, 5, '#4a3b5c', 1) + blush(33, 82, 8, 1.4) +
      `<path d="M61 56 q8 22 16 0z" fill="#fff" opacity=".55"/><ellipse cx="69" cy="56" rx="8.5" ry="3.4" fill="none" stroke="#fff" stroke-width="1.8"/>` +
      squirrelFish(70, 62, -70) + squirrelFish(78, 36, -15) + squirrelFish(56, 30, 10),
    // cozy sleepy sheep clouds
    dream_4: () => DREAM_SKY + dreamDust + sheep(30, 56, 1.2) + sheep(52, 86, 1.45) + sheep(28, 116, 1.1) +
      `<text x="74" y="50" font-family="monospace" font-weight="700" font-size="11" fill="#fff">z</text><text x="82" y="40" font-family="monospace" font-weight="700" font-size="8" fill="#fff">z</text>`,
    // curled-up sleeping fox with flying bunnies
    dream_5: () => DREAM_SKY + dreamDust + bunny(26, 48, -12) + bunny(72, 40, 14) + bunny(54, 64, 0) + cloud(18, 122, 1.9, '#fff', 0.85) +
      `<ellipse cx="54" cy="104" rx="27" ry="15" fill="#ff8c42"/><path d="M78 104 Q86 122 58 120 Q40 119 34 112" stroke="#ff8c42" stroke-width="10" fill="none" stroke-linecap="round"/><circle cx="35" cy="112" r="5.4" fill="#fff"/>` +
      `<path d="M24 92 L24 78 L33 86Z M48 90 L47 77 L39 86Z" fill="#ff8c42"/><circle cx="36" cy="97" r="12" fill="#ff8c42"/><ellipse cx="36" cy="102" rx="7" ry="5" fill="#fff"/>` +
      sleepy(32, 96, 8) + `<circle cx="36" cy="101" r="1.5" fill="#4a3b5c"/>`,
    // pastel hot-air balloons in the clouds
    dream_6: () => DREAM_SKY + dreamDust + cloud(54, 128, 1.5, '#fff', 0.9) + cloud(2, 132, 1.3, '#fff', 0.9) + balloon(34, 62, 1.25, '#ff9fb5', '#ffd6de') +
      balloon(72, 46, 0.85, '#8fd3c8', '#d5f2ec') + balloon(72, 96, 0.7, '#b9a3f0', '#e3d9fb'),
    // golden cycle arrows around a dream-catcher
    dream_jolly: () => {
      let web = '';
      for (let i = 0; i < 4; i++) web += `<path d="M36 72 h28" stroke="#fff3c4" stroke-width="1" transform="rotate(${i * 45} 50 72)"/>`;
      const feather = (x, y) => `<path d="M${x} ${y} v10" stroke="#c98a2b" stroke-width="1"/><ellipse cx="${x}" cy="${y + 15}" rx="2.6" ry="6" fill="#fff3c4"/><circle cx="${x}" cy="${y + 9}" r="1.5" fill="#ff8fa3"/>`;
      return DREAM_SKY + dreamDust + cycle(50, 72, 31, '#f5a623', 5) + web + `<circle cx="50" cy="72" r="14" fill="none" stroke="#e08a1e" stroke-width="3.4"/><circle cx="50" cy="72" r="7" fill="none" stroke="#fff3c4" stroke-width="1"/><circle cx="50" cy="72" r="2.2" fill="#ff8fa3"/>` +
        feather(42, 85) + feather(50, 87) + feather(58, 85);
    },

    // ---------- Nightmare fronts ----------
    // grinning shadow wolf on a crescent moon
    nightmare_1: () => NIGHT_SKY + nightDust +
      `<circle cx="50" cy="86" r="36" fill="#c9a7ff" mask="url(#m-cres)"/>` +
      `<path d="M62 112 q14 -2 12 -16" stroke="#170f2e" stroke-width="5" fill="none" stroke-linecap="round"/><ellipse cx="52" cy="102" rx="12" ry="13" fill="#170f2e"/>` +
      `<path d="M38 76 L40 54 L49 67 L55 67 L64 54 L66 76 Q66 94 52 95 Q38 94 38 76Z" fill="#170f2e"/>` +
      `<path d="M43 75 l6 2 l-6 2z M61 75 l-6 2 l6 2z" fill="#ffe066"/><path d="M43 85 l3 3 l3 -3 l3 3 l3 -3 l3 3 l3 -3" stroke="#fff" stroke-width="1.6" fill="none" stroke-linejoin="round"/>`,
    // three purple fluffy flowers with skull faces
    nightmare_2: () => {
      const f = (x, y) => {
        let fluff = '';
        for (let i = 0; i < 7; i++) {
          const a = (Math.PI * 2 * i) / 7;
          fluff += `<circle cx="${(x + Math.cos(a) * 9).toFixed(1)}" cy="${(y + Math.sin(a) * 9).toFixed(1)}" r="6.5" fill="#9b6bdf"/>`;
        }
        return `<path d="M${x} ${y + 8} Q${x - 4} ${y + 30} ${x} 134" stroke="#3d7a63" stroke-width="2.4" fill="none"/><path d="M${x} ${y + 28} l7 -4 l-1 6z" fill="#3d7a63"/>` + fluff +
          `<path d="M${x - 7} ${y - 1} a7 7.5 0 0 1 14 0 q0 5 -3 6 v3 h-8 v-3 q-3 -1 -3 -6z" fill="#f3ecff"/>` + eyes(x - 3, y - 1, 6, '#2b1d57', 2) +
          `<path d="M${x - 2} ${y + 5} v3 M${x} ${y + 5} v3 M${x + 2} ${y + 5} v3" stroke="#2b1d57" stroke-width=".8"/>`;
      };
      return NIGHT_SKY + nightDust + f(25, 84) + f(75, 90) + f(50, 60);
    },
    // horned imp carrying a sack in dark clouds
    nightmare_3: () => NIGHT_SKY + nightDust + cloud(4, 60, 1.3, '#1f1444', 0.9) + cloud(56, 48, 1.2, '#1f1444', 0.9) +
      `<circle cx="67" cy="88" r="15" fill="#7a6a8f"/><path d="M58 76 l6 -9 l7 3 l-3 8z" fill="#7a6a8f"/><path d="M60 75 h10" stroke="#f3d27a" stroke-width="2"/>` +
      `<ellipse cx="44" cy="102" rx="12" ry="15" fill="#8a5bd6"/><path d="M50 96 q8 -6 12 -18" stroke="#8a5bd6" stroke-width="4" fill="none" stroke-linecap="round"/>` +
      `<path d="M34 72 L30 56 L40 66Z M54 72 L58 56 L48 66Z" fill="#f3ecff"/><circle cx="44" cy="78" r="13" fill="#9b6bdf"/>` +
      `<path d="M37 75 l6 2 l-6 2z M51 75 l-6 2 l6 2z" fill="#ffe066"/><path d="M38 84 q6 5 12 0 l-2 -1 l-2 2 l-2 -2 l-2 2 l-2 -2z" fill="#fff"/>` +
      `<rect x="38" y="115" width="4" height="7" fill="#6b43b5"/><rect x="47" y="115" width="4" height="7" fill="#6b43b5"/>` + cloud(8, 130, 1.7, '#1f1444', 0.95) + cloud(58, 134, 1.4, '#1f1444', 0.95),
    // totem stack of grinning bug-skulls
    nightmare_4: () => {
      const bug = (y, w, c) =>
        `<path d="M${50 - w} ${y + 2} l-7 -4 M${50 - w} ${y + 8} l-7 3 M${50 + w} ${y + 2} l7 -4 M${50 + w} ${y + 8} l7 3" stroke="${c}" stroke-width="1.8" stroke-linecap="round"/>` +
        `<rect x="${50 - w}" y="${y - 9}" width="${w * 2}" height="24" rx="10" fill="${c}"/>` + eyes(50 - w * 0.42, y - 1, w * 0.84, '#1d1238', 3.4) + eyes(50 - w * 0.42, y - 1, w * 0.84, '#ffe066', 1.1) +
        `<path d="M${50 - w * 0.5} ${y + 6} h${w} v3 q-${w / 2} 4 -${w} 0z" fill="#fff"/><path d="M${50 - w * 0.17} ${y + 6} v5 M${50 + w * 0.17} ${y + 6} v5" stroke="#1d1238" stroke-width=".8"/>`;
      return NIGHT_SKY + nightDust + `<path d="M43 40 q-6 -10 -12 -8 M57 40 q6 -10 12 -8" stroke="#c9a7ff" stroke-width="1.8" fill="none" stroke-linecap="round"/><circle cx="31" cy="32" r="2.4" fill="#ffe066"/><circle cx="69" cy="32" r="2.4" fill="#ffe066"/>` +
        bug(112, 21, '#7a4fc9') + bug(86, 18, '#9b6bdf') + bug(60, 15, '#b98cf2') + cloud(20, 136, 1.6, '#1f1444', 0.9);
    },
    // three-eyed bat with eyes on its wings
    nightmare_5: () => {
      const wing = `<path d="M50 76 Q30 46 6 62 Q15 70 13 84 Q24 77 29 92 Q39 82 50 96Z" fill="#7a4fc9"/><circle cx="26" cy="72" r="5" fill="#fff"/><circle cx="26.6" cy="72.6" r="2.2" fill="#1d1238"/>`;
      const eye = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff"/><circle cx="${x}" cy="${y + 0.6}" r="${r * 0.45}" fill="#1d1238"/>`;
      return NIGHT_SKY + nightDust + `<circle cx="74" cy="34" r="9" fill="#c9a7ff" opacity=".55"/>` + wing + `<g transform="translate(100 0) scale(-1 1)">${wing}</g>` +
        `<path d="M40 70 L37 52 L47 64Z M60 70 L63 52 L53 64Z" fill="#9b6bdf"/><ellipse cx="50" cy="82" rx="13" ry="17" fill="#9b6bdf"/>` +
        eye(44, 80, 3.6) + eye(56, 80, 3.6) + eye(50, 71, 3) + `<path d="M43 89 q7 5 14 0 l-3 0 l-1.5 4 l-1.5 -4 h-2 l-1.5 4 l-1.5 -4z" fill="#fff"/>`;
    },
    // grinning jellyfish / octopus
    nightmare_6: () => {
      let t = '';
      [28, 39, 50, 61, 72].forEach((x, i) => {
        t += `<path d="M${x} 84 q-6 10 0 18 q6 9 ${i % 2 ? 3 : -3} 20" stroke="${i % 2 ? '#9b6bdf' : '#b98cf2'}" stroke-width="5" fill="none" stroke-linecap="round"/>`;
      });
      return NIGHT_SKY + nightDust + t + `<path d="M22 88 Q20 44 50 44 Q80 44 78 88 Q50 96 22 88Z" fill="#b98cf2"/><ellipse cx="38" cy="56" rx="8" ry="4" fill="#d9c7ff" opacity=".6" transform="rotate(-25 38 56)"/>` +
        eyes(40, 68, 20, '#fff', 5) + eyes(41, 69, 20, '#1d1238', 2.2) + `<path d="M34 78 h32 q-4 10 -16 10 q-12 0 -16 -10z" fill="#1d1238"/><path d="M36 78 h28 l-1 3 h-26z" fill="#fff"/><path d="M43 78 v3 M50 78 v3 M57 78 v3" stroke="#1d1238" stroke-width=".8"/>`;
    },
    // swirling vortex with cycle arrows
    nightmare_jolly: () => NIGHT_SKY + nightDust + cycle(50, 72, 31, '#d59bff', 5) +
      `<circle cx="50" cy="72" r="18" fill="#1d1238"/><path d="M50 72 m0 -14 a14 14 0 1 1 -14 14 a10 10 0 1 1 10 10 a6.5 6.5 0 1 1 6.5 -6.5 a3 3 0 1 1 -3 -3" fill="none" stroke="#b98cf2" stroke-width="2.6" stroke-linecap="round"/>` +
      spark(50, 72, '#ffe066', 1.4) + spark(30, 116, '#d59bff') + spark(72, 118, '#d59bff', 1.2),

    // ---------- REM ----------
    // green floral hedgehog holding a honey wand
    rem: () => {
      const flower = (x, y, c = '#ffb3c7') => {
        let p = '';
        for (let i = 0; i < 5; i++) {
          const a = (Math.PI * 2 * i) / 5 - 1.57;
          p += `<circle cx="${(x + Math.cos(a) * 3.2).toFixed(1)}" cy="${(y + Math.sin(a) * 3.2).toFixed(1)}" r="2.6" fill="${c}"/>`;
        }
        return p + `<circle cx="${x}" cy="${y}" r="1.8" fill="#ffe066"/>`;
      };
      let spines = '';
      for (let i = 0; i < 9; i++) {
        const a = Math.PI + (Math.PI * i) / 8;
        spines += `<circle cx="${(56 + Math.cos(a) * 27).toFixed(1)}" cy="${(102 + Math.sin(a) * 33).toFixed(1)}" r="7" fill="#3f8f5f"/>`;
      }
      return REM_SKY + spark(16, 40, '#fff') + spark(84, 36, '#fff') + px(74, 54, '#fff') + px(24, 60, '#fff') + spines +
        `<path d="M29 104 Q29 68 56 68 Q83 68 83 104Z" fill="#4fa56f"/>` + flower(48, 78) + flower(66, 82, '#fff') + flower(58, 94) + flower(74, 98) + flower(42, 92, '#fff') +
        `<path d="M22 102 L26 60" stroke="#b9854f" stroke-width="2.2" stroke-linecap="round"/><ellipse cx="26.6" cy="55" rx="5.5" ry="2.4" fill="#f5a623"/><ellipse cx="27.2" cy="50.5" rx="5" ry="2.4" fill="#ffc94d"/><ellipse cx="27.6" cy="46" rx="4" ry="2.2" fill="#f5a623"/><path d="M24 57 q-1 6 1 9 q2 -3 1 -9z" fill="#ffc94d"/>` +
        `<ellipse cx="36" cy="104" rx="15" ry="11.5" fill="#fff1d6"/><circle cx="21.5" cy="104" r="2.6" fill="#4a3b5c"/><circle cx="32" cy="100" r="1.8" fill="#4a3b5c"/>` + arc(26, 108, 6, '#4a3b5c', false, 1.2) +
        `<circle cx="38" cy="106" r="2.6" fill="#ff8fa3" opacity=".6"/><circle cx="25" cy="100" r="3" fill="#fff1d6"/><ellipse cx="40" cy="116" rx="5" ry="2.8" fill="#fff1d6"/><ellipse cx="68" cy="116" rx="5" ry="2.8" fill="#fff1d6"/>` +
        `<rect y="117" width="100" height="23" fill="#6fb87f" opacity=".55"/>`;
    },
  };

  // ---------- card backs ----------
  const frame = (c) => `<rect x="6" y="6" width="88" height="128" rx="8" fill="none" stroke="${c}" stroke-width="1.6" stroke-dasharray="3 3" opacity=".7"/>`;
  const BACK_SKY = {
    dream: sky('g-bd', '#ffbe55', '#ff8f3c'),
    nightmare: sky('g-bn', '#241a52', '#4a2f8a'),
    rem: sky('g-br', '#1c4636', '#2f6b4f'),
  };
  const backs = {
    // smiling sun
    dream: () => {
      let rays = '';
      for (let i = 0; i < 12; i++) rays += `<path d="M50 34 l5 12 h-10z" fill="#ffe27a" transform="rotate(${i * 30} 50 70)"/>`;
      return BACK_SKY.dream + frame('#fff3c4') + spark(18, 22, '#fff3c4') + spark(82, 118, '#fff3c4') + px(80, 24, '#fff3c4') + px(18, 114, '#fff3c4') +
        rays + `<circle cx="50" cy="70" r="20" fill="#ffe27a"/><circle cx="50" cy="70" r="20" fill="none" stroke="#f5a623" stroke-width="1.6"/>` +
        eyes(43, 67, 14, '#7a4a1e', 2) + arc(44, 73, 12, '#7a4a1e', false, 1.8) + blush(39, 73, 22, 2.6);
    },
    // angry storm cloud + lightning
    nightmare: () => BACK_SKY.nightmare + frame('#b79cf2') + spark(18, 22, '#b79cf2') + spark(82, 118, '#b79cf2') + px(80, 24, '#b79cf2') + px(18, 114, '#b79cf2') +
      `<path d="M54 80 L42 104 h9 l-5 18 l18 -26 h-10 l7 -16z" fill="#ffe066" stroke="#f5a623" stroke-width="1"/>` + cloud(23, 72, 2.05, '#8e78c9') + cloud(26, 70, 1.85, '#a995dd') +
      `<path d="M36 62 l10 4 M64 62 l-10 4" stroke="#241a52" stroke-width="2.2" stroke-linecap="round"/>` + eyes(42, 70, 16, '#241a52', 2.2) + arc(44, 79, 12, '#241a52', true, 1.8),
    // pastel pink flower
    rem: () => {
      let petals = '';
      for (let i = 0; i < 6; i++) petals += `<ellipse cx="50" cy="50" rx="9" ry="14" fill="#ffb3c7" transform="rotate(${i * 60} 50 68)"/>`;
      return BACK_SKY.rem + frame('#9ed3a8') + spark(18, 22, '#9ed3a8') + spark(82, 118, '#9ed3a8') + px(80, 24, '#9ed3a8') + px(18, 114, '#9ed3a8') +
        `<path d="M50 84 Q46 104 50 122" stroke="#6fb87f" stroke-width="3" fill="none"/><ellipse cx="60" cy="106" rx="10" ry="4.5" fill="#6fb87f" transform="rotate(-28 60 106)"/><ellipse cx="40" cy="112" rx="9" ry="4" fill="#6fb87f" transform="rotate(28 40 112)"/>` +
        petals + `<circle cx="50" cy="68" r="8" fill="#ffe27a"/>` + eyes(47, 67, 6, '#7a4a1e', 1.2) + arc(47.5, 70, 5, '#7a4a1e', false, 1);
    },
  };

  const svg = (inner) => `<svg viewBox="0 0 100 140" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${inner}</svg>`;
  const keyOf = (card, back) => (back ? 'back_' + card.type : card.type === 'rem' ? 'rem' : card.type + '_' + card.value);

  const custom = {}; // key -> image url, filled in when ./assets/<key>.png exists
  const ALL_KEYS = ['back_dream', 'back_nightmare', 'back_rem', 'rem'];
  ['dream', 'nightmare'].forEach((t) => [1, 2, 3, 4, 5, 6, 'jolly'].forEach((v) => ALL_KEYS.push(t + '_' + v)));

  // Probe ./assets/ for custom PNGs; anything missing keeps its built-in illustration.
  function loadCustom(onFound) {
    ALL_KEYS.forEach((key) => {
      const img = new Image();
      img.onload = () => { custom[key] = img.src; if (onFound) onFound(key); };
      img.src = 'assets/' + key + '.png';
    });
  }

  function cardHTML(card, opts) {
    const back = (opts && opts.back) || card.hidden;
    const key = keyOf(card, back);
    let inner;
    if (custom[key]) {
      inner = `<img class="card-img" src="${custom[key]}" alt="" draggable="false">`;
    } else if (back) {
      inner = svg(backs[card.type]());
    } else {
      const mark = card.type === 'rem' ? 'REM' : card.value === 'jolly' ? '↻' : card.value;
      inner = svg(fronts[key]()) + `<span class="corner l">${mark}</span><span class="corner r">${mark}</span>`;
    }
    const cls = `card ${card.type} ${back ? 'back' : 'front'}${!back && card.type === 'rem' ? ' is-rem' : ''}`;
    return `<div class="${cls}" data-card-id="${card.id}">${inner}</div>`;
  }

  function cardName(card) {
    if (card.hidden) return 'a card';
    if (card.type === 'rem') return 'REM';
    const fam = card.type === 'dream' ? 'Dream' : 'Nightmare';
    return card.value === 'jolly' ? fam + ' Jolly ↻' : fam + ' ' + card.value;
  }

  if (root.document) {
    sharedDefs += `<mask id="m-cres" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="140"><rect width="100" height="140" fill="#fff"/><circle cx="58" cy="74" r="29" fill="#000"/></mask>`;
    const holder = root.document.createElement('div');
    holder.innerHTML = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${sharedDefs}</defs></svg>`;
    root.document.body.appendChild(holder.firstChild);
  }

  D.Art = { cardHTML, cardName, loadCustom, custom, ALL_KEYS };
})(typeof globalThis !== 'undefined' ? globalThis : this);

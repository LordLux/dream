// Dream — screens, rendering, input and the three game modes.
(function () {
  const D = window.Dream;
  const E = D.Engine, Art = D.Art, Sfx = D.Sfx;
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const ctx = {
    mode: null,        // 'bot' | 'hotseat' | 'host' | 'guest'
    state: null,       // full game state (not available to an online guest)
    view: null,        // what the local viewer may see — everything is rendered from this
    seat: 0,           // seat shown at the bottom of the table
    selected: null,    // id of the selected hand card
    locked: false,     // input blocked (pass screen, waiting for the host…)
    lastEvent: 0,
    gameId: 0,
    net: null,
    winShown: false,
    wantIntro: false,  // play the shuffle & deal animation on the next fresh table
    dealing: false,    // ...which is running right now
    introWaiters: [],
    introTimers: [],
  };
  let remSteal = false;
  try { remSteal = localStorage.getItem('dream-rem-steal') === '1'; } catch (e) { /* storage blocked */ }

  // ---------- helpers ----------
  function showScreen(id) {
    ['menu', 'lobby', 'game'].forEach((s) => $('#' + s).classList.toggle('hidden', s !== id));
  }
  let toastTimer = 0;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add('hidden'), 2600);
  }
  function label(seat) {
    if (ctx.mode === 'hotseat') return 'Player ' + (seat + 1);
    if (seat === ctx.seat) return 'You';
    return ctx.mode === 'bot' ? 'Dreamy Bot' : 'Friend';
  }
  const poss = (seat) => (label(seat) === 'You' ? 'your' : label(seat) + "'s");
  const online = () => ctx.mode === 'host' || ctx.mode === 'guest';
  const canAct = () => !!ctx.view && !ctx.locked && !ctx.dealing && ctx.view.winner === null && ctx.view.turn === ctx.seat;
  const myHand = () => ctx.view.players[ctx.seat].hand;
  const selectedCard = () => myHand().find((c) => c.id === ctx.selected) || null;

  function describe(ev) {
    const who = label(ev.seat);
    const name = Art.cardName(ev.card);
    const slot = ev.slot + 1;
    switch (ev.kind) {
      case 'draw': return `${who} drew a ${ev.card.type === 'dream' ? 'Dream' : 'Nightmare'} card.`;
      case 'discard': return `${who} discarded ${name}.`;
      case 'swap': return `${who} played ${name} on slot ${slot} and took ${poss(1 - ev.seat)} REM! ✿`;
      case 'steal': return `${who} sent ${name} to slot ${slot} and stole ${Art.cardName(ev.taken)}! ⚡`;
      default:
        if (ev.taken && ev.taken.type === 'nightmare') return `${who} chased a Nightmare away with ${name} on slot ${slot}.`;
        if (ev.taken) return `${who} covered slot ${slot} with a duplicate ${name}.`;
        return `${who} placed ${name} on slot ${slot}.`;
    }
  }

  // ---------- rendering ----------
  const HAND_ORDER = { rem: 0, dream: 1, nightmare: 2 };
  function sortHand(hand) {
    const val = (c) => (c.value === 'jolly' ? 7 : c.value || 0);
    return hand.slice().sort((a, b) => HAND_ORDER[a.type] - HAND_ORDER[b.type] || val(a) - val(b) || a.id - b.id);
  }
  function boardHTML(player, seat) {
    return player.board.map((card, i) =>
      `<div class="slot" data-seat="${seat}" data-slot="${i}"><span class="num">${i + 1}</span>${card ? Art.cardHTML(card) : ''}</div>`
    ).join('');
  }
  function pipsHTML(player) {
    return player.board.map((c) => `<i class="${E.isFilled(c) ? 'on' : ''}"></i>`).join('');
  }

  function draw() {
    const v = ctx.view;
    if (!v) return;
    const me = v.players[ctx.seat], opp = v.players[1 - ctx.seat];
    $('#opp-name').textContent = label(1 - ctx.seat);
    $('#my-name').textContent = ctx.mode === 'hotseat' ? label(ctx.seat) : 'You';
    $('#opp-pips').innerHTML = pipsHTML(opp);
    $('#my-pips').innerHTML = pipsHTML(me);
    const count = $('#my-count');
    count.textContent = me.hand.length + '/' + E.HAND_LIMIT + ' cards';
    count.classList.toggle('full', me.hand.length >= E.HAND_LIMIT);
    $('#opp-hand').innerHTML = opp.hand.map((c) => Art.cardHTML(c, { back: true })).join('');
    $('#my-hand').innerHTML = sortHand(me.hand).map((c) => Art.cardHTML(c)).join('');
    $('#opp-board').innerHTML = boardHTML(opp, 1 - ctx.seat);
    $('#my-board').innerHTML = boardHTML(me, ctx.seat);
    $('#pile').innerHTML = Art.cardHTML(v.top, { back: true });
    $('#discard').innerHTML = v.discardTop ? Art.cardHTML(v.discardTop) : '<span class="bin">🗑</span>';
    $('#rule-chip').classList.toggle('hidden', !v.settings.nightmareStealsRem);
    if (v.event) $('#log').textContent = describe(v.event);
    else $('#log').textContent = 'A new night begins… ' + label(v.turn) + (label(v.turn) === 'You' ? ' go first.' : ' goes first.');
    if (ctx.selected !== null && !selectedCard()) ctx.selected = null;
    fitHand();
    refresh();
  }

  // Spread the hand out when there is room, overlap the cards when there is not.
  function fitHand() {
    const el = $('#my-hand');
    const n = el.children.length;
    if (n < 2) return;
    const cw = el.firstElementChild.getBoundingClientRect().width;
    const room = el.parentElement.clientWidth - 8;
    el.style.setProperty('--gap', Math.min(cw * 0.06, (room - n * cw) / (n - 1)).toFixed(1) + 'px');
  }
  window.addEventListener('resize', () => { if (ctx.view) fitHand(); });

  // Selection / turn dependent classes — never rebuilds the DOM (safe mid-drag).
  function refresh() {
    const v = ctx.view;
    if (!v) return;
    const act = canAct();
    const banner = $('#turn-banner');
    const mine = v.turn === ctx.seat;
    if (ctx.dealing) banner.textContent = 'Shuffling…';
    else if (v.winner !== null) banner.textContent = label(v.winner) === 'You' ? 'You win!' : label(v.winner) + ' wins!';
    else if (mine) banner.textContent = ctx.mode === 'hotseat' ? label(ctx.seat) + "'s turn" : 'Your turn';
    else banner.textContent = label(v.turn) + (ctx.mode === 'bot' ? ' is thinking…' : "'s turn…");
    banner.classList.toggle('mine', mine && v.winner === null && !ctx.dealing);

    $('#my-hand').classList.toggle('active', act);
    $$('#my-hand .card').forEach((el) => el.classList.toggle('selected', +el.dataset.cardId === ctx.selected));
    $$('.slot').forEach((el) => { el.className = 'slot'; });
    const card = act ? selectedCard() : null;
    const full = myHand().length >= E.HAND_LIMIT;
    let targets = [];
    if (card) {
      targets = E.targetsFor(v, ctx.seat, card);
      targets.forEach((t) => {
        const seat = t.side === 'own' ? ctx.seat : 1 - ctx.seat;
        const el = $(`.slot[data-seat="${seat}"][data-slot="${t.slot}"]`);
        el.classList.add('valid', 'valid-' + (t.over ? 'over' : t.kind));
      });
    }
    $('#pile').classList.toggle('valid', act && !full && !card);
    $('#discard').classList.toggle('valid', act && full && !!card);

    let hint = '';
    if (v.winner !== null || ctx.dealing) hint = '';
    else if (!act) hint = mine ? '' : 'Watch the card backs — they tell you what your opponent holds.';
    else if (card) {
      hint = targets.length ? 'Tap a glowing slot to play ' + Art.cardName(card) + '.' : Art.cardName(card) + ' has nowhere to go right now.';
      if (full) hint += ' Or tap the discard bin.';
    } else if (full) hint = 'Hand full! Play a card, or select one and discard it.';
    else hint = 'Tap the draw pile, or select a card to play.';
    $('#hint').textContent = hint;
  }

  // ---------- flying card animations ----------
  function locEl(loc, card) {
    if (loc.loc === 'hand') return $(`.hand .card[data-card-id="${card.id}"]`);
    if (loc.loc === 'slot') return $(`.slot[data-seat="${loc.seat}"][data-slot="${loc.slot}"]`);
    return loc.loc === 'pile' ? $('#pile') : $('#discard');
  }
  function fly(move, from, delay) {
    const toEl = locEl(move.to, move.card);
    if (!from || !toEl || !toEl.animate) return;
    const to = toEl.getBoundingClientRect();
    const hide = move.to.loc === 'slot' ? toEl.querySelector('.card') : move.to.loc === 'hand' ? toEl : null;
    if (hide) hide.style.visibility = 'hidden';
    const ghost = document.createElement('div');
    ghost.className = 'fly';
    ghost.style.setProperty('--cw', from.width + 'px');
    ghost.innerHTML = Art.cardHTML(move.card);
    document.body.appendChild(ghost);
    const scale = to.width / from.width;
    const anim = ghost.animate([
      { transform: `translate(${from.left}px, ${from.top}px) scale(1)` },
      { transform: `translate(${to.left}px, ${to.top}px) scale(${scale})` },
    ], { duration: 420, delay, easing: 'cubic-bezier(.3,.9,.3,1)', fill: 'both' });
    const done = () => {
      ghost.remove();
      if (hide) { hide.style.visibility = ''; hide.classList.add('pop'); }
    };
    anim.onfinish = done;
    anim.oncancel = done;
  }

  // Take a new view of the game: animate what just happened, then settle.
  function show(view) {
    const ev = view.event;
    if (ctx.dealing) endIntro(true); // something happened mid-deal: skip to the table
    const fresh = ev && ev.n > ctx.lastEvent;
    const rects = fresh ? ev.moves.map((m) => { const el = locEl(m.from, m.card); return el ? el.getBoundingClientRect() : null; }) : [];
    const turnWas = ctx.view ? ctx.view.turn : null;
    ctx.view = view;
    ctx.lastEvent = ev ? ev.n : 0;
    draw();
    if (ctx.wantIntro) {
      ctx.wantIntro = false;
      if (!ev) playIntro();
    }
    if (fresh) {
      ev.moves.forEach((m, i) => fly(m, rects[i], i * 220));
      Sfx.play(ev.kind);
      if (view.winner === null && view.turn === ctx.seat && turnWas !== ctx.seat && ctx.mode !== 'hotseat') {
        setTimeout(() => Sfx.play('turn'), 500);
      }
    }
    if (view.winner !== null && !ctx.winShown) {
      ctx.winShown = true;
      const gid = ctx.gameId;
      setTimeout(() => { if (gid === ctx.gameId) showWin(); }, 1100);
    }
    if (view.winner === null) {
      ctx.winShown = false;
      $('#win-overlay').classList.add('hidden');
    }
  }

  // ---------- game flow ----------
  function startGame(mode) {
    ctx.mode = mode;
    ctx.gameId++;
    ctx.selected = null;
    ctx.lastEvent = 0;
    ctx.locked = false;
    ctx.winShown = false;
    ctx.view = null;
    endIntro(false);
    ctx.wantIntro = true;
    $('#win-overlay').classList.add('hidden');
    $('#pass-overlay').classList.add('hidden');
    showScreen('game');
    if (mode === 'guest') { ctx.state = null; ctx.seat = 1; return; } // the host sends the first state
    ctx.state = E.newGame({ nightmareStealsRem: remSteal });
    ctx.seat = mode === 'hotseat' ? ctx.state.turn : 0;
    afterChange();
  }

  function afterChange() {
    const s = ctx.state;
    if (ctx.mode === 'host') ctx.net.send({ t: 'state', view: E.viewFor(s, 1) });
    show(E.viewFor(s, ctx.seat));
    if (s.winner !== null) return;
    const gid = ctx.gameId;
    afterIntro(() => {
      if (gid !== ctx.gameId) return;
      if (ctx.mode === 'bot' && s.turn === 1) setTimeout(() => botTurn(gid), 1000 + Math.random() * 500);
      if (ctx.mode === 'hotseat') {
        ctx.locked = true;
        refresh();
        if (!s.event) showPass();
        else setTimeout(() => { if (gid === ctx.gameId) showPass(); }, 1300);
      }
    });
  }

  // ---------- shuffle & deal intro ----------
  // The real table is already rendered underneath with the hands and draw pile hidden
  // (#game.dealing); face-down ghost cards shuffle in the middle, burst out to both
  // hands, and the rest of the deck slides to the draw pile.
  function afterIntro(fn) {
    if (ctx.dealing) ctx.introWaiters.push(fn); else fn();
  }

  function playIntro() {
    const game = $('#game');
    if (!game.animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    ctx.dealing = true;
    game.classList.add('dealing');
    refresh();

    const w = $('#my-board .slot').getBoundingClientRect().width;
    const h = w * 1.4;
    const mid = $('.mid').getBoundingClientRect();
    const cx = mid.left + mid.width / 2, cy = mid.top + mid.height / 2;
    const typeOf = (el) => ['dream', 'nightmare', 'rem'].find((t) => el.classList.contains(t));
    // Deal each hand in a random order (never REM first), so the deck really looks mixed.
    const mixed = (sel) => {
      const els = $$(sel);
      for (let i = els.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [els[i], els[j]] = [els[j], els[i]];
      }
      const other = els.findIndex((el) => typeOf(el) !== 'rem');
      if (other > 0) [els[0], els[other]] = [els[other], els[0]];
      return els;
    };
    const mine = mixed('#my-hand .card'), theirs = mixed('#opp-hand .card');
    const deals = []; // alternate: one to me, one to them
    for (let i = 0; i < Math.max(mine.length, theirs.length); i++) {
      if (mine[i]) deals.push(mine[i]);
      if (theirs[i]) deals.push(theirs[i]);
    }
    const REST = 7;
    // bottom of the deck first; the first card to be dealt ends up on top
    const stack = [];
    for (let i = 0; i < REST; i++) stack.push({ type: Math.random() < 0.5 ? 'dream' : 'nightmare', to: null });
    stack[REST - 1].type = ctx.view.top.type; // the card that will top the draw pile
    for (let i = deals.length - 1; i >= 0; i--) stack.push({ type: typeOf(deals[i]), to: deals[i], order: i });

    const layer = document.createElement('div');
    layer.id = 'intro-layer';
    document.body.appendChild(layer);
    // Shuffle in the style of pakastin's deck-of-cards: on every pass the deck gets a new
    // random order; each card slides sideways out of the stack by a random amount (no
    // rotation), takes its new depth while it is out, and slides back in.
    const PASSES = 3, PASS = 400, ENTER = 160;
    const SHUFFLE = ENTER + PASSES * PASS + 90, STEP = 85, FLIGHT = 380;
    const dealEnd = SHUFFLE + deals.length * STEP;
    const later = (ms, fn) => ctx.introTimers.push(setTimeout(fn, ms));
    const DEPTH = 0.6; // px each card sits up-and-left of the one below: gives the stack its thickness
    const randomOrder = () => {
      const o = stack.map((_, i) => i);
      for (let i = o.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [o[i], o[j]] = [o[j], o[i]];
      }
      return o;
    };
    // orders[p][i] = depth of card i after pass p; the last pass lands in dealing order
    const startOrder = randomOrder();
    const orders = [];
    for (let p = 0; p < PASSES; p++) orders.push(p < PASSES - 1 ? randomOrder() : stack.map((_, i) => i));
    const ghosts = [];
    orders.forEach((o, p) => later(ENTER + p * PASS + PASS / 2, () => ghosts.forEach((g, i) => { g.style.zIndex = o[i]; })));

    stack.forEach((item, i) => {
      const ghost = document.createElement('div');
      ghost.className = 'fly deal';
      ghost.style.setProperty('--cw', w + 'px');
      ghost.innerHTML = Art.cardHTML({ id: -100 - i, type: item.type, hidden: true });
      layer.appendChild(ghost);
      ghosts.push(ghost);
      ghost.style.zIndex = startOrder[i];
      const rnd = (lo, hi) => lo + Math.random() * (hi - lo);
      const pickSide = () => (Math.random() < 0.5 ? -1 : 1);
      const side = pickSide();
      const stackAt = (depth, dx = 0, rot = 0) =>
        `translate(${cx - w / 2 - depth * DEPTH + dx}px, ${cy - h / 2 - depth * DEPTH}px) rotate(${rot}deg)`;
      const at = (dx, rot) => stackAt(i, dx, rot);
      const frames = [
        { transform: stackAt(startOrder[i]) + ' scale(.6)', opacity: 0, offset: 0, easing: 'ease-out' },
        { transform: stackAt(startOrder[i]), opacity: 1, offset: ENTER / SHUFFLE, easing: 'ease-in-out' },
      ];
      orders.forEach((o, p) => {
        const t0 = ENTER + p * PASS;
        const out = pickSide() * w * rnd(0.32, 0.95);
        frames.push({ transform: stackAt(o[i], out), offset: (t0 + PASS / 2) / SHUFFLE, easing: 'ease-in-out' });
        frames.push({ transform: stackAt(o[i]), offset: (t0 + PASS) / SHUFFLE, easing: 'ease-in-out' });
      });
      frames.push({ transform: at(0, 0), offset: 1 });
      ghost.animate(frames, { duration: SHUFFLE, fill: 'both' });

      const flyTo = (el, delay, duration, spin) => {
        const r = el.getBoundingClientRect();
        const end = `translate(${r.left + r.width / 2 - w / 2}px, ${r.top + r.height / 2 - h / 2}px) rotate(0deg) scale(${r.width / w})`;
        ghost.animate([{ transform: at(0, 0) }, { transform: at(0, spin), offset: 0.12 }, { transform: end }],
          { duration, delay, easing: 'cubic-bezier(.3,.9,.3,1)', fill: 'forwards' });
      };
      if (item.to) {
        const delay = SHUFFLE + item.order * STEP;
        flyTo(item.to, delay, FLIGHT, side * 20);
        later(delay, () => Sfx.play('deal'));
      } else {
        flyTo($('#pile'), dealEnd + 160 + i * 25, 420, 0);
      }
    });
    Sfx.play('shuffle');
    later(dealEnd + 160 + REST * 25 + 470, () => endIntro(true));
  }

  function endIntro(runWaiters) {
    if (!ctx.dealing) return;
    ctx.dealing = false;
    ctx.introTimers.forEach(clearTimeout);
    ctx.introTimers = [];
    const layer = $('#intro-layer');
    if (layer) layer.remove();
    $('#game').classList.remove('dealing');
    const waiters = ctx.introWaiters;
    ctx.introWaiters = [];
    if (runWaiters) {
      $$('#my-hand .card').forEach((el) => el.classList.add('pop')); // "flip" the dealt hand face-up
      refresh();
      waiters.forEach((fn) => fn());
    }
  }

  function botTurn(gid) {
    const s = ctx.state;
    if (gid !== ctx.gameId || ctx.mode !== 'bot' || !s || s.winner !== null || s.turn !== 1) return;
    E.applyAction(s, 1, D.Bot.choose(s, 1));
    afterChange();
  }

  function commit(action) {
    if (!canAct()) return;
    ctx.selected = null;
    if (ctx.mode === 'guest') {
      ctx.locked = true; // until the host answers
      ctx.net.send({ t: 'action', action });
      refresh();
      return;
    }
    const res = E.applyAction(ctx.state, ctx.seat, action);
    if (!res.ok) { toast(res.error); Sfx.play('error'); refresh(); return; }
    afterChange();
  }

  function showPass() {
    $('#pass-name').textContent = label(ctx.state.turn);
    $('#pass-overlay').classList.remove('hidden');
  }
  $('#pass-ready').addEventListener('click', () => {
    ctx.seat = ctx.state.turn;
    ctx.locked = false;
    ctx.selected = null;
    show(E.viewFor(ctx.state, ctx.seat));
    $('#pass-overlay').classList.add('hidden');
    Sfx.play('turn');
  });

  function showWin() {
    const v = ctx.view;
    if (!v || v.winner === null) return;
    const iWon = v.winner === ctx.seat;
    const hot = ctx.mode === 'hotseat';
    $('#win-emoji').textContent = hot || iWon ? '🌟' : '🌧️';
    $('#win-title').textContent = hot ? label(v.winner) + ' wins!' : iWon ? 'You win!' : label(v.winner) + ' wins!';
    $('#win-sub').textContent = hot || iWon ? 'All six dreams came true. Sweet dreams!' : 'The nightmares got you this time…';
    const secs = Math.max(1, Math.round((Date.now() - v.startedAt) / 1000));
    const time = Math.floor(secs / 60) + ':' + String(secs % 60).padStart(2, '0');
    const order = [ctx.seat, 1 - ctx.seat];
    const rows = [['Cards drawn', 'draws'], ['Dreams placed', 'plays'], ['Dreams stolen', 'steals'], ['REM swaps', 'swaps'], ['Discards', 'discards']];
    $('#win-stats').innerHTML =
      `<div class="match-line"><span>⏱ ${time}</span><span>↻ ${v.stats.turns} turns</span></div>` +
      `<table><tr><th></th>${order.map((s) => `<th class="${s === v.winner ? 'won' : ''}">${label(s)}${s === v.winner ? ' ★' : ''}</th>`).join('')}</tr>` +
      rows.map(([name, key]) => `<tr><td>${name}</td>${order.map((s) => `<td>${v.stats.p[s][key]}</td>`).join('')}</tr>`).join('') + '</table>';
    const colors = ['#ffd98a', '#ffa94d', '#ff9fb5', '#b98cf2', '#8fd3c8', '#fff'];
    let bits = '';
    if (hot || iWon) {
      for (let i = 0; i < 46; i++) {
        bits += `<i style="left:${Math.random() * 100}%;background:${colors[i % colors.length]};animation-duration:${3 + Math.random() * 4}s;animation-delay:${-Math.random() * 6}s"></i>`;
      }
    }
    $('#confetti').innerHTML = bits;
    $('#win-overlay').classList.remove('hidden');
    Sfx.play(hot || iWon ? 'win' : 'lose');
  }

  function toMenu() {
    ctx.gameId++;
    endIntro(false);
    if (ctx.net) { ctx.net.close(); ctx.net = null; }
    ctx.mode = null;
    ctx.state = null;
    ctx.view = null;
    ['win-overlay', 'pass-overlay', 'quit-confirm'].forEach((id) => $('#' + id).classList.add('hidden'));
    setLobby('choose');
    setLobbyStatus('');
    showScreen('menu');
  }

  $('#again-btn').addEventListener('click', () => {
    if (ctx.mode === 'guest') { ctx.net.send({ t: 'rematch' }); toast('Asking the host for a rematch…'); }
    else startGame(ctx.mode);
  });
  $('#win-menu-btn').addEventListener('click', toMenu);
  $('#quit-btn').addEventListener('click', () => {
    const over = !ctx.view || ctx.view.winner !== null;
    if (over) toMenu();
    else $('#quit-confirm').classList.remove('hidden');
  });
  $('#quit-yes').addEventListener('click', () => { $('#quit-confirm').classList.add('hidden'); toMenu(); });
  $('#quit-no').addEventListener('click', () => $('#quit-confirm').classList.add('hidden'));
  $('#quit-confirm').addEventListener('click', (e) => { if (e.target.id === 'quit-confirm') e.target.classList.add('hidden'); });

  // ---------- online ----------
  // 'choose' shows both options; 'host' / 'join' leave only the one in progress,
  // plus a "Go back" link that cancels it. The change is animated: the panel that
  // goes away tucks itself behind the one that stays, which glides to the centre
  // (and the other way round when coming back).
  let lobbyAnims = [];
  function setLobby(mode) {
    const panels = [$('#host-panel'), $('#join-panel')];
    const rectOf = (el) => (el.offsetParent ? el.getBoundingClientRect() : null);
    lobbyAnims.forEach((an) => an.finish());
    lobbyAnims = [];
    const before = panels.map(rectOf);
    // where each piece of a panel sits right now, so pieces that vanish can fade out in place
    const pieces = panels.map((el) => Array.from(el.children).map((child) => (
      child.offsetParent ? { child, left: child.offsetLeft, top: child.offsetTop, width: child.offsetWidth } : { child }
    )));

    $('#host-panel').classList.toggle('hidden', mode === 'join');
    $('#join-panel').classList.toggle('hidden', mode === 'host');
    $('.lobby-grid').classList.toggle('solo', mode !== 'choose');
    $('#lobby-return').classList.toggle('hidden', mode === 'choose');
    $('#host-btn').classList.toggle('hidden', mode === 'host');
    $('#host-btn').disabled = mode !== 'choose';
    $('#join-btn').disabled = mode !== 'choose';
    $('#join-code').disabled = mode !== 'choose';
    $('#host-room').classList.toggle('hidden', mode !== 'host');
    if (mode === 'host') { // the code stays behind its cloud until the room is open
      $('#code-stage').classList.add('pending');
      $('#room-code').textContent = '·····';
      $('#room-wait').textContent = 'Dreaming up a room code';
    }

    const after = panels.map(rectOf);
    if (!panels[0].animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const opts = { duration: 520, easing: 'cubic-bezier(.45,0,.2,1)' };
    const run = (el, frames, onDone) => {
      const an = el.animate(frames, opts);
      an.onfinish = onDone;
      lobbyAnims.push(an);
    };
    const centre = (r) => [r.left + r.width / 2, r.top + r.height / 2];
    panels.forEach((el, i) => {
      const was = before[i], now = after[i];
      const otherWas = before[1 - i], otherNow = after[1 - i];
      if (was && now) { // stays: glide from the old spot to the new one, on top, growing or shrinking to fit
        const same = (k) => Math.abs(was[k] - now[k]) < 1;
        if (same('left') && same('top') && same('width') && same('height')) return;
        el.style.zIndex = 2;
        el.style.overflow = 'hidden';
        // The page re-centres itself as the card changes height, so measure where the card
        // sits at its old size in the new layout and start the glide from exactly there.
        el.style.width = was.width + 'px';
        el.style.height = was.height + 'px';
        const start = el.getBoundingClientRect();
        el.style.width = '';
        el.style.height = '';
        run(el, [
          { transform: `translate(${was.left - start.left}px, ${was.top - start.top}px)`, width: was.width + 'px', height: was.height + 'px' },
          { transform: 'none', width: now.width + 'px', height: now.height + 'px' },
        ], () => { el.style.zIndex = ''; el.style.overflow = ''; });
        // cross-fade what changed inside: old pieces fade out where they were, new ones fade in
        pieces[i].forEach((piece) => {
          const shown = !!piece.child.offsetParent;
          if (piece.width !== undefined && !shown) {
            const ghost = piece.child.cloneNode(true);
            ghost.classList.remove('hidden');
            [ghost, ...ghost.querySelectorAll('[id]')].forEach((n) => n.removeAttribute('id'));
            ghost.style.cssText = `position:absolute;left:${piece.left}px;top:${piece.top}px;width:${piece.width}px;margin:0;pointer-events:none`;
            el.appendChild(ghost);
            const an = ghost.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: 'ease-out', fill: 'forwards' });
            an.onfinish = () => ghost.remove();
            lobbyAnims.push(an);
          } else if (piece.width === undefined && shown) {
            lobbyAnims.push(piece.child.animate([{ opacity: 0 }, { opacity: 0, offset: 0.35 }, { opacity: 1 }], { duration: 520, easing: 'ease-out' }));
          }
        });
      } else if (was && otherNow) { // leaves: a stand-in slides behind the panel that stays
        const ghost = el.cloneNode(true);
        ghost.classList.remove('hidden');
        ghost.classList.add('lobby-ghost');
        [ghost, ...ghost.querySelectorAll('[id]')].forEach((n) => n.removeAttribute('id'));
        ghost.style.cssText = `left:${was.left}px;top:${was.top}px;width:${was.width}px;height:${was.height}px`;
        $('#lobby').appendChild(ghost);
        const [x0, y0] = centre(was), [x1, y1] = centre(otherNow);
        const tucked = `translate(${x1 - x0}px, ${y1 - y0}px) scale(.82)`;
        run(ghost, [{ transform: 'none', opacity: 1 }, { transform: tucked, opacity: 1, offset: 0.75 }, { transform: tucked, opacity: 0 }],
          () => ghost.remove());
      } else if (now && otherWas) { // returns: slides back out from behind the other panel
        const [x0, y0] = centre(otherWas), [x1, y1] = centre(now);
        const tucked = `translate(${x0 - x1}px, ${y0 - y1}px) scale(.82)`;
        run(el, [{ transform: tucked, opacity: 0 }, { transform: tucked, opacity: 1, offset: 0.25 }, { transform: 'none', opacity: 1 }], null);
      }
    });
  }
  function setLobbyStatus(msg, isError) {
    const el = $('#lobby-status');
    el.textContent = msg;
    el.classList.toggle('err', !!isError);
  }
  function netFailed(msg) {
    const inGame = !$('#game').classList.contains('hidden');
    if (ctx.net) { ctx.net.close(); ctx.net = null; }
    if (inGame) { toMenu(); toast(msg); return; }
    setLobby('choose');
    setLobbyStatus(msg, true);
  }

  $('#host-btn').addEventListener('click', () => {
    if (ctx.net) ctx.net.close();
    setLobby('host');
    setLobbyStatus('');
    const asked = Date.now();
    const net = ctx.net = D.Net.create('host', null, (ev, data) => {
      if (ev === 'open') {
        // let the cloud be seen for a moment even when the code arrives instantly
        setTimeout(() => {
          if (ctx.net !== net) return;
          $('#room-code').textContent = data;
          $('#room-wait').textContent = 'Waiting for your friend to join';
          $('#code-stage').classList.remove('pending');
        }, Math.max(0, 900 - (Date.now() - asked)));
      } else if (ev === 'connected') {
        startGame('host');
      } else if (ev === 'data') {
        if (!ctx.state || !data) return;
        if (data.t === 'action') {
          const res = E.applyAction(ctx.state, 1, data.action);
          if (res.ok) afterChange();
          else ctx.net.send({ t: 'error', msg: res.error, view: E.viewFor(ctx.state, 1) });
        } else if (data.t === 'rematch' && ctx.state.winner !== null) {
          startGame('host');
        }
      } else if (ev === 'closed') {
        netFailed('Your friend disconnected.');
      } else if (ev === 'error') {
        netFailed(data);
      }
    });
  });

  function join() {
    const code = $('#join-code').value.trim().toUpperCase();
    if (code.length < 4) { setLobbyStatus('Enter the room code first.', true); return; }
    if (ctx.net) ctx.net.close();
    setLobby('join');
    setLobbyStatus('Looking for room ' + code + '…');
    ctx.net = D.Net.create('guest', code, (ev, data) => {
      if (ev === 'connected') {
        setLobbyStatus('Connected! Dealing cards…');
      } else if (ev === 'data') {
        if (!data) return;
        if (data.t === 'full') { netFailed('That room is already full.'); return; }
        if (data.t === 'error') { toast(data.msg); Sfx.play('error'); }
        if (data.view) {
          if (ctx.mode !== 'guest' || (data.view.winner === null && data.view.eventN === 0)) startGame('guest');
          ctx.locked = false;
          show(data.view);
        }
      } else if (ev === 'closed') {
        netFailed('The host disconnected.');
      } else if (ev === 'error') {
        netFailed(data);
      }
    });
  }
  $('#join-btn').addEventListener('click', join);
  $('#join-code').addEventListener('keydown', (e) => { if (e.key === 'Enter') join(); });
  $('#join-code').addEventListener('input', (e) => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });
  // Clicking the room code copies it; the code hops and the label above it confirms.
  let copyTimer = 0;
  $('#copy-code').addEventListener('click', () => {
    const btn = $('#copy-code'), lbl = $('#room-label');
    const code = $('#room-code').textContent;
    const flash = (ok) => {
      btn.classList.remove('copied');
      void btn.offsetWidth; // restart the hop if clicked again
      btn.classList.toggle('copied', ok);
      lbl.textContent = ok ? 'Copied! ✓' : 'Copy failed — select it by hand';
      lbl.classList.toggle('ok', ok);
      clearTimeout(copyTimer);
      copyTimer = setTimeout(() => { btn.classList.remove('copied'); lbl.classList.remove('ok'); lbl.textContent = 'Room code'; }, 1600);
    };
    // older route for pages without clipboard access (plain http on a LAN address, file://…)
    const legacy = () => {
      const box = document.createElement('textarea');
      box.value = code;
      box.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
      document.body.appendChild(box);
      box.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { /* not supported */ }
      box.remove();
      flash(ok);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code).then(() => flash(true), legacy);
    else legacy();
  });
  $('#lobby-back').addEventListener('click', toMenu);
  $('#lobby-return').addEventListener('click', () => {
    if (ctx.net) { ctx.net.close(); ctx.net = null; }
    setLobby('choose');
    setLobbyStatus('');
  });

  // ---------- input: tap-to-select + drag-and-drop (one pointer handler for mouse & touch) ----------
  function select(id) {
    if (ctx.selected !== id) Sfx.play('select');
    ctx.selected = id;
    refresh();
  }
  function activate(target) {
    if (ctx.selected === null) return;
    if (target.id === 'discard') commit({ type: 'discard', cardId: ctx.selected });
    else commit({ type: 'play', cardId: ctx.selected, side: +target.dataset.seat === ctx.seat ? 'own' : 'opp', slot: +target.dataset.slot });
  }
  const dropTarget = (x, y) => {
    const el = document.elementFromPoint(x, y);
    return el ? el.closest('.slot.valid, #discard.valid') : null;
  };

  // Tapping a card plays it straight away when there is exactly one place it can go.
  // With several options (or when it would only cover a duplicate) it is selected instead.
  function tapCard(id) {
    if (ctx.selected === id) { ctx.selected = null; refresh(); return; }
    const card = myHand().find((c) => c.id === id);
    if (!card) return;
    const targets = E.targetsFor(ctx.view, ctx.seat, card);
    if (targets.length === 1 && !targets[0].over) {
      commit({ type: 'play', cardId: id, side: targets[0].side, slot: targets[0].slot });
      return;
    }
    // With a full hand the card must stay selectable so it can be discarded.
    if (!targets.length && myHand().length < E.HAND_LIMIT) {
      ctx.selected = null;
      refresh();
      toast(Art.cardName(card) + (card.type === 'nightmare' ? ' has no Dream to steal.' : ' has nowhere to go.'));
      Sfx.play('error');
      return;
    }
    select(id);
  }

  let drag = null;
  const hand = $('#my-hand');
  hand.addEventListener('pointerdown', (e) => {
    const el = e.target.closest('.card');
    if (!el || !canAct() || (e.pointerType === 'mouse' && e.button !== 0)) return;
    drag = { id: +el.dataset.cardId, el, pid: e.pointerId, x: e.clientX, y: e.clientY, moved: false, ghost: null, over: null };
    try { el.setPointerCapture(e.pointerId); } catch (err) { /* synthetic pointer */ }
  });
  hand.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.pid) return;
    if (!drag.moved) {
      if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 8) return;
      drag.moved = true;
      select(drag.id);
      const r = drag.el.getBoundingClientRect();
      drag.ox = e.clientX - r.left;
      drag.oy = e.clientY - r.top;
      drag.ghost = drag.el.cloneNode(true);
      drag.ghost.className = drag.ghost.className.replace('selected', '') + ' drag-ghost';
      drag.ghost.style.setProperty('--cw', r.width + 'px');
      document.body.appendChild(drag.ghost);
      drag.el.classList.add('dragging');
    }
    drag.ghost.style.transform = `translate(${e.clientX - drag.ox}px, ${e.clientY - drag.oy}px)`;
    const over = dropTarget(e.clientX, e.clientY);
    if (over !== drag.over) {
      if (drag.over) drag.over.classList.remove('hover');
      if (over) over.classList.add('hover');
      drag.over = over;
    }
  });
  function endDrag(e) {
    if (!drag || e.pointerId !== drag.pid) return;
    const d = drag;
    drag = null;
    if (!d.moved) {
      if (e.type === 'pointerup') tapCard(d.id);
      return;
    }
    d.ghost.remove();
    d.el.classList.remove('dragging');
    if (d.over) d.over.classList.remove('hover');
    const target = e.type === 'pointerup' ? dropTarget(e.clientX, e.clientY) : null;
    if (target) activate(target);
  }
  hand.addEventListener('pointerup', endDrag);
  hand.addEventListener('pointercancel', endDrag);

  $('#game').addEventListener('click', (e) => {
    const target = e.target.closest('.slot.valid, #discard.valid');
    if (target) { activate(target); return; }
    if (e.target.closest('#pile')) {
      if (!canAct()) return;
      if (myHand().length >= E.HAND_LIMIT) { toast('Your hand is full — play or discard a card.'); Sfx.play('error'); return; }
      commit({ type: 'draw' });
    }
  });

  // ---------- menu, settings, modals ----------
  $$('[data-mode]').forEach((btn) => btn.addEventListener('click', () => {
    Sfx.play('select');
    if (btn.dataset.mode === 'online') { setLobbyStatus(''); showScreen('lobby'); }
    else startGame(btn.dataset.mode);
  }));

  function syncRule() {
    $$('.rule-rem-steal').forEach((box) => { box.checked = remSteal; });
    $$('.rule-state').forEach((el) => { el.textContent = remSteal ? 'On' : 'Off'; });
  }
  $$('.rule-rem-steal').forEach((box) => box.addEventListener('change', () => {
    remSteal = box.checked;
    try { localStorage.setItem('dream-rem-steal', remSteal ? '1' : '0'); } catch (e) { /* storage blocked */ }
    syncRule();
  }));
  syncRule();

  function syncMute() {
    $$('.mute-btn').forEach((btn) => {
      btn.textContent = btn.classList.contains('link-btn') ? (Sfx.muted ? '🔇 Sound off' : '🔊 Sound on') : (Sfx.muted ? '🔇' : '🔊');
    });
  }
  $$('.mute-btn').forEach((btn) => btn.addEventListener('click', () => { Sfx.toggle(); syncMute(); Sfx.play('select'); }));
  syncMute();

  $$('[data-open]').forEach((btn) => btn.addEventListener('click', () => $('#' + btn.dataset.open).classList.remove('hidden')));
  $$('[data-close]').forEach((btn) => btn.addEventListener('click', () => $('#' + btn.dataset.close).classList.add('hidden')));
  $('#rules').addEventListener('click', (e) => { if (e.target.id === 'rules') e.target.classList.add('hidden'); });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!$('#quit-confirm').classList.contains('hidden')) $('#quit-confirm').classList.add('hidden');
    else if (!$('#rules').classList.contains('hidden')) $('#rules').classList.add('hidden');
    else if (ctx.selected !== null) { ctx.selected = null; refresh(); }
  });

  // ---------- decoration ----------
  let stars = '';
  for (let i = 0; i < 90; i++) {
    stars += `<i class="${i % 7 === 0 ? 'big' : ''}" style="left:${(Math.random() * 100).toFixed(2)}%;top:${(Math.random() * 100).toFixed(2)}%;animation-delay:${(-Math.random() * 3).toFixed(2)}s;animation-duration:${(2 + Math.random() * 3).toFixed(2)}s"></i>`;
  }
  $('#stars').innerHTML = stars;

  function drawMenuFan() {
    $('#menu-fan').innerHTML = [
      { id: -1, type: 'nightmare', value: 1 }, { id: -2, type: 'rem', value: null }, { id: -3, type: 'dream', value: 5 },
    ].map((c) => Art.cardHTML(c)).join('');
  }
  drawMenuFan();

  // Swap in custom PNGs from ./assets/ as they are found.
  let artTimer = 0;
  Art.loadCustom(() => {
    clearTimeout(artTimer);
    artTimer = setTimeout(() => { drawMenuFan(); if (!drag) draw(); }, 60);
  });

  // An invite link like …/#ABCDE jumps straight to the join box.
  const invite = location.hash.replace(/[^a-z0-9]/gi, '').toUpperCase();
  if (invite.length >= 4 && invite.length <= 5) {
    $('#join-code').value = invite;
    showScreen('lobby');
  }

  // Handy for poking at the game from the console: edit Dream.debug.state, then Dream.debug.sync().
  ctx.sync = () => show(E.viewFor(ctx.state, ctx.seat));
  D.debug = ctx;
})();

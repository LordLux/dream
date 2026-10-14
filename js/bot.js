// Dream — bot opponent. Scores every legal action and picks the best one.
//
// Four levels:
//   easy      plays loosely and often overlooks a steal or a swap
//   normal    greedy: the best-looking move this turn
//   hard      also weighs what the opponent could do back, from what any player may know:
//             the backs of their cards, and the cards they took off a board in plain sight
//   nightmare hard, and it cheats a little: it sees the top of the draw pile and every card
//             the opponent draws
(function (root) {
  const D = (root.Dream = root.Dream || {});
  const E = D.Engine;
  const LEVELS = ['easy', 'normal', 'hard', 'nightmare'];
  const NAMES = { easy: 'Sleepy Bot', normal: 'Dreamy Bot', hard: 'Lucid Bot', nightmare: 'Nightmare Bot' };
  const WILD = 0.06 / 0.5;              // chance that a face-down Dream (or Nightmare) is a Jolly
  const HIT = WILD + (1 - WILD) / 6;    // chance that it can be played on one given slot

  // A bot that remembers what it has seen. Call observe() after every action of the game.
  function create(level) {
    if (!LEVELS.includes(level)) level = 'normal';
    const known = new Set(); // ids of cards in the opponent's hand whose face the bot has seen
    return {
      level,
      name: NAMES[level],
      observe(state, seat) {
        const ev = state.event;
        if (!ev || ev.seat === seat) return;
        if (ev.kind === 'swap' || ev.kind === 'steal') known.add(ev.taken.id); // it lay on my board
        if (ev.kind === 'draw' && level === 'nightmare') known.add(ev.card.id);
      },
      choose(state, seat) { return pick(state, seat, level, known); },
    };
  }

  function pick(state, seat, level, known) {
    let acts = E.legalActions(state, seat);
    const easy = level === 'easy';
    if (easy && Math.random() < 0.45) { // not paying attention to the other board this turn
      const rest = acts.filter((a) => a.kind !== 'swap' && a.kind !== 'steal');
      if (rest.length) acts = rest;
    }
    const sharp = level === 'hard' || level === 'nightmare' ? read(state, seat, level, known) : null;
    let best = null;
    let bestScore = -Infinity;
    for (const a of acts) {
      let s = sharp ? sharpScore(state, seat, a, sharp) : score(state, seat, a);
      s = easy ? s * 0.4 + Math.random() * 26 : s + Math.random() * 3;
      if (s > bestScore) { bestScore = s; best = a; }
    }
    return best;
  }

  const choose = (state, seat) => pick(state, seat, 'normal', null);

  function score(state, seat, a) {
    const me = state.players[seat];
    const opp = state.players[1 - seat];
    const oppFilled = E.filledCount(opp);
    const holdsDream = (n, exceptId) =>
      me.hand.some((c) => c.type === 'dream' && c.value === n && c.id !== exceptId);

    if (a.type === 'draw') return 20;

    const card = me.hand.find((c) => c.id === a.cardId);
    if (a.type === 'discard') return 5 - keepValue(state, seat, card) / 100;

    if (a.kind === 'place') {
      if (wins(state, seat, a)) return 1000;
      if (a.over) {
        // Dumping a duplicate onto my own Dream: only worth it as a discard substitute.
        return card.value === 'jolly' ? -50 : 2;
      }
      if (card.type === 'dream' && card.value !== 'jolly') return 60;
      // Wildcards: don't spend them on a slot I can fill with a numbered card.
      if (holdsDream(a.slot + 1)) return -20;
      return card.type === 'rem' ? 40 : 45;
    }

    if (a.kind === 'swap') {
      let s = 80;
      if (card.value === 'jolly') s -= 15;
      else if (E.isFilled(me.board[a.slot]) || holdsDream(card.value, card.id)) s += 10; // a duplicate
      return s;
    }

    // Nightmare steal
    const victim = opp.board[a.slot];
    let s = 30;
    if (oppFilled >= 5) s += 60; // they are one card from winning
    else if (oppFilled === 4) s += 20;
    if (victim.type === 'rem') s += 40;
    else if (victim.value === 'jolly') s += 25;
    else if (!E.isFilled(me.board[victim.value - 1]) && !holdsDream(victim.value)) s += 25; // a Dream I need
    if (card.value === 'jolly') s -= 5;
    return s;
  }

  // ---------- hard & nightmare ----------

  // What the bot can tell about the opponent's hand.
  function read(state, seat, level, known) {
    const opp = state.players[1 - seat];
    const seen = [];
    const hidden = { dream: 0, nightmare: 0 };
    for (const c of opp.hand) {
      if (c.type === 'rem') continue;
      if (known.has(c.id)) seen.push(c); else hidden[c.type]++;
    }
    // How likely they are to have a card of that family for that slot.
    const can = (type, slot) => (seen.some((c) => c.type === type && E.matches(c, slot))
      ? 1 : 1 - Math.pow(1 - HIT, hidden[type]));
    return {
      // the chance that a card I put on my board is taken straight back off it
      risk(card, slot) {
        if (card.type !== 'rem') return can('nightmare', slot);
        const swap = can('dream', slot);
        return state.settings.nightmareStealsRem ? 1 - (1 - swap) * (1 - can('nightmare', slot)) : swap;
      },
      top: level === 'nightmare' ? state.top : null,
      seen,
    };
  }

  // How much a card is worth to the player in that seat, 0..1 (hand: the cards they are known to hold).
  function worth(state, seat, card, hand) {
    const me = state.players[seat];
    const opp = state.players[1 - seat];
    if (card.type === 'dream') {
      if (card.value === 'jolly') return 1;
      const s = card.value - 1;
      if (opp.board[s] && opp.board[s].type === 'rem') return 1; // swaps for their REM
      if (E.isFilled(me.board[s])) return 0.05;
      return hand.some((c) => c.type === 'dream' && c.value === card.value) ? 0.15 : 1;
    }
    const stealable = (c) => !!c && (c.type === 'dream' || (c.type === 'rem' && state.settings.nightmareStealsRem));
    if (card.value === 'jolly') return opp.board.some(stealable) ? 1 : 0.6;
    const there = opp.board[card.value - 1];
    if (stealable(there)) return 1;
    return there ? 0.1 : 0.35; // nothing to take there yet
  }

  function sharpScore(state, seat, a, sharp) {
    const me = state.players[seat];
    const base = score(state, seat, a);

    if (a.type === 'draw') {
      let s = base;
      if (sharp.top) { // it knows the card: take it for itself, or to keep it from them
        s = 8 + 26 * worth(state, seat, sharp.top, me.hand) + 14 * worth(state, 1 - seat, sharp.top, sharp.seen);
      } else if (state.top.type === 'dream' && E.filledCount(me) + me.hand.filter((c) => c.type !== 'nightmare').length < E.SLOTS) {
        s += 4; // the back shows a Dream, and Dreams are what it is short of
      }
      return s;
    }
    if (a.type !== 'play' || a.kind !== 'place' || a.over || base >= 1000) return base;

    // Putting a card on my own board: is it likely to be taken straight back off?
    const card = me.hand.find((c) => c.id === a.cardId);
    const risk = sharp.risk(card, a.slot);
    const crowded = me.hand.length >= E.HAND_LIMIT - 1;
    if (card.type === 'rem') {
      // A REM in hand is safe; on the board a matching Dream swaps it away. Play it late.
      return base - 46 * risk + (crowded ? 16 : 0);
    }
    if (risk === 1 && !crowded) return 16; // they hold the Nightmare for it: keep it for the last move
    return base - 12 * risk;
  }

  function wins(state, seat, a) {
    const sim = JSON.parse(JSON.stringify(state));
    return E.applyAction(sim, seat, a).ok && sim.winner === seat;
  }

  // How much the bot wants to keep a card when forced to discard.
  function keepValue(state, seat, card) {
    const me = state.players[seat];
    const dupes = me.hand.filter((c) => c.type === card.type && c.value === card.value).length;
    if (card.type === 'rem') return 100;
    if (card.type === 'dream') {
      if (card.value === 'jolly') return 90;
      if (dupes > 1) return 10;
      return E.isFilled(me.board[card.value - 1]) ? 15 : 70;
    }
    if (card.value === 'jolly') return 60;
    return dupes > 1 ? 12 : 30;
  }

  D.Bot = { LEVELS, NAMES, create, choose, score };
})(typeof globalThis !== 'undefined' ? globalThis : this);

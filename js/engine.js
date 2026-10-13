// Dream — pure game rules. No DOM in here, so it runs in the browser and in Node tests.
(function (root) {
  const D = (root.Dream = root.Dream || {});
  const SLOTS = 6;
  const HAND_LIMIT = 8;

  // Infinite deck: 44% numbered Dream, 44% numbered Nightmare, 6% each Jolly.
  function generateCard(state, rand) {
    const r = (rand || Math.random)();
    const num = () => 1 + Math.floor((rand || Math.random)() * 6);
    let type, value;
    if (r < 0.44) { type = 'dream'; value = num(); }
    else if (r < 0.88) { type = 'nightmare'; value = num(); }
    else if (r < 0.94) { type = 'dream'; value = 'jolly'; }
    else { type = 'nightmare'; value = 'jolly'; }
    return { id: state.nextId++, type, value };
  }

  function newGame(settings, rand) {
    const state = {
      nextId: 1,
      settings: { nightmareStealsRem: !!(settings && settings.nightmareStealsRem) },
      players: [],
      turn: (rand || Math.random)() < 0.5 ? 0 : 1,
      top: null,
      discardTop: null,
      discardCount: 0,
      winner: null,
      event: null,
      eventN: 0,
      startedAt: Date.now(),
      stats: { turns: 0, p: [newStats(), newStats()] },
    };
    for (let seat = 0; seat < 2; seat++) {
      const hand = [{ id: state.nextId++, type: 'rem', value: null }];
      for (let i = 0; i < 4; i++) hand.push(generateCard(state, rand));
      state.players.push({ hand, board: new Array(SLOTS).fill(null) });
    }
    state.top = generateCard(state, rand);
    return state;
  }

  function newStats() {
    return { draws: 0, plays: 0, steals: 0, swaps: 0, discards: 0 };
  }

  const matches = (card, slot) => card.value === 'jolly' || card.value === slot + 1;
  const isFilled = (card) => !!card && card.type !== 'nightmare';
  const filledCount = (player) => player.board.filter(isFilled).length;
  const canDraw = (state, seat) => state.players[seat].hand.length < HAND_LIMIT;
  const canDiscard = (state, seat) => state.players[seat].hand.length >= HAND_LIMIT;

  // Every slot the given hand card may be played on.
  // kind: 'place' (own board), 'swap' (REM swap-steal), 'steal' (Nightmare).
  function targetsFor(state, seat, card) {
    const me = state.players[seat];
    const opp = state.players[1 - seat];
    const out = [];
    for (let s = 0; s < SLOTS; s++) {
      const mine = me.board[s];
      const theirs = opp.board[s];
      if (card.type === 'rem') {
        if (!isFilled(mine)) out.push({ side: 'own', slot: s, kind: 'place' });
      } else if (card.type === 'dream' && matches(card, s)) {
        // Own REM is protected from being overwritten by accident.
        if (!mine || mine.type !== 'rem') {
          out.push({ side: 'own', slot: s, kind: 'place', over: isFilled(mine) });
        }
        if (theirs && theirs.type === 'rem') out.push({ side: 'opp', slot: s, kind: 'swap' });
      } else if (card.type === 'nightmare' && matches(card, s)) {
        const stealable = theirs && (theirs.type === 'dream' ||
          (theirs.type === 'rem' && state.settings.nightmareStealsRem));
        if (stealable) out.push({ side: 'opp', slot: s, kind: 'steal' });
      }
    }
    return out;
  }

  function legalActions(state, seat) {
    const acts = [];
    if (state.winner !== null || state.turn !== seat) return acts;
    const hand = state.players[seat].hand;
    if (canDraw(state, seat)) acts.push({ type: 'draw' });
    for (const card of hand) {
      for (const t of targetsFor(state, seat, card)) {
        acts.push({ type: 'play', cardId: card.id, side: t.side, slot: t.slot, kind: t.kind, over: !!t.over });
      }
      if (canDiscard(state, seat)) acts.push({ type: 'discard', cardId: card.id });
    }
    return acts;
  }

  function toDiscard(state, card) {
    state.discardTop = card;
    state.discardCount++;
  }

  function applyAction(state, seat, action) {
    const fail = (error) => ({ ok: false, error });
    if (state.winner !== null) return fail('The game is over.');
    if (state.turn !== seat) return fail('It is not your turn.');
    if (!action || typeof action !== 'object') return fail('Invalid action.');
    const me = state.players[seat];
    const opp = state.players[1 - seat];
    const stats = state.stats.p[seat];
    const handLoc = (s) => ({ loc: 'hand', seat: s });
    let event;

    if (action.type === 'draw') {
      if (!canDraw(state, seat)) return fail('Your hand is full (8 cards).');
      const card = state.top;
      me.hand.push(card);
      state.top = generateCard(state);
      stats.draws++;
      event = { kind: 'draw', seat, card, moves: [{ card, from: { loc: 'pile' }, to: handLoc(seat) }] };
    } else if (action.type === 'discard') {
      if (!canDiscard(state, seat)) return fail('You can only discard with 8 cards in hand.');
      const idx = me.hand.findIndex((c) => c.id === action.cardId);
      if (idx < 0) return fail('That card is not in your hand.');
      const card = me.hand.splice(idx, 1)[0];
      toDiscard(state, card);
      stats.discards++;
      event = { kind: 'discard', seat, card, moves: [{ card, from: handLoc(seat), to: { loc: 'discard' } }] };
    } else if (action.type === 'play') {
      const idx = me.hand.findIndex((c) => c.id === action.cardId);
      if (idx < 0) return fail('That card is not in your hand.');
      const card = me.hand[idx];
      const target = targetsFor(state, seat, card)
        .find((t) => t.side === action.side && t.slot === action.slot);
      if (!target) return fail('That card cannot be played there.');
      me.hand.splice(idx, 1);
      const slot = target.slot;
      const owner = target.side === 'own' ? seat : 1 - seat;
      const slotLoc = { loc: 'slot', seat: owner, slot };
      const moves = [{ card, from: handLoc(seat), to: slotLoc }];
      let taken = null;
      if (target.kind === 'place') {
        taken = me.board[slot];
        me.board[slot] = card;
        if (taken) {
          toDiscard(state, taken);
          moves.push({ card: taken, from: slotLoc, to: { loc: 'discard' } });
        }
        stats.plays++;
      } else {
        // swap & steal: my card stays in their slot, their card comes to my hand.
        taken = opp.board[slot];
        opp.board[slot] = card;
        me.hand.push(taken);
        moves.push({ card: taken, from: slotLoc, to: handLoc(seat) });
        if (target.kind === 'swap') stats.swaps++; else stats.steals++;
      }
      event = { kind: target.kind, seat, card, slot, taken, over: !!target.over, moves };
    } else {
      return fail('Unknown action.');
    }

    event.n = ++state.eventN;
    state.event = event;
    state.stats.turns++;
    for (let s = 0; s < 2; s++) {
      if (filledCount(state.players[s]) === SLOTS) state.winner = s;
    }
    if (state.winner === null) state.turn = 1 - seat;
    return { ok: true };
  }

  // What one seat is allowed to see: opponent hand and the draw pile keep
  // their card type (the backs are public) but lose their value.
  function viewFor(state, seat) {
    const view = JSON.parse(JSON.stringify(state));
    const hide = (c) => ({ id: c.id, type: c.type, hidden: true });
    view.players[1 - seat].hand = view.players[1 - seat].hand.map(hide);
    view.top = hide(view.top);
    const ev = view.event;
    if (ev && ev.kind === 'draw' && ev.seat !== seat) {
      ev.card = hide(ev.card);
      ev.moves.forEach((m) => { m.card = hide(m.card); });
    }
    return view;
  }

  D.Engine = {
    SLOTS, HAND_LIMIT, newGame, generateCard, targetsFor, legalActions, applyAction,
    viewFor, isFilled, filledCount, canDraw, canDiscard, matches,
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);

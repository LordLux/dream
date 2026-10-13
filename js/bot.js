// Dream — bot opponent. Scores every legal action and picks the best one.
(function (root) {
  const D = (root.Dream = root.Dream || {});
  const E = D.Engine;

  function choose(state, seat) {
    const acts = E.legalActions(state, seat);
    let best = null;
    let bestScore = -Infinity;
    for (const a of acts) {
      const s = score(state, seat, a) + Math.random() * 3;
      if (s > bestScore) { bestScore = s; best = a; }
    }
    return best;
  }

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

  D.Bot = { choose, score };
})(typeof globalThis !== 'undefined' ? globalThis : this);

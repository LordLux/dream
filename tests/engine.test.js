// Run with: node tests/engine.test.js
const assert = require('assert');
require('../js/engine.js');
require('../js/bot.js');
const E = globalThis.Dream.Engine;
const Bot = globalThis.Dream.Bot;

let id = 1000;
const card = (type, value) => ({ id: id++, type, value: value === undefined ? null : value });
function setup(opts = {}) {
  const s = E.newGame({ nightmareStealsRem: !!opts.remSteal });
  s.turn = 0;
  s.players.forEach((p) => { p.hand = []; p.board = new Array(6).fill(null); });
  return s;
}
const play = (s, seat, c, side, slot) => E.applyAction(s, seat, { type: 'play', cardId: c.id, side, slot });
let n = 0;
const test = (name, fn) => { fn(); n++; console.log('  ok  ' + name); };

test('setup: 5 cards each, exactly one REM, visible top card', () => {
  const s = E.newGame();
  for (const p of s.players) {
    assert.equal(p.hand.length, 5);
    assert.equal(p.hand.filter((c) => c.type === 'rem').length, 1);
  }
  assert.ok(s.top && s.top.type !== 'rem');
});

test('deck probabilities are ~44/44/6/6 and never produce REM', () => {
  const s = E.newGame();
  const k = { dn: 0, nn: 0, dj: 0, nj: 0 };
  const N = 40000;
  for (let i = 0; i < N; i++) {
    const c = E.generateCard(s);
    assert.notEqual(c.type, 'rem');
    k[(c.type === 'dream' ? 'd' : 'n') + (c.value === 'jolly' ? 'j' : 'n')]++;
  }
  assert.ok(Math.abs(k.dn / N - 0.44) < 0.02 && Math.abs(k.nn / N - 0.44) < 0.02);
  assert.ok(Math.abs(k.dj / N - 0.06) < 0.01 && Math.abs(k.nj / N - 0.06) < 0.01);
});

test('draw takes the top card, refills it, passes the turn; blocked at 8', () => {
  const s = setup();
  const top = s.top;
  assert.ok(E.applyAction(s, 0, { type: 'draw' }).ok);
  assert.equal(s.players[0].hand[0], top);
  assert.notEqual(s.top.id, top.id);
  assert.equal(s.turn, 1);
  assert.ok(!E.applyAction(s, 0, { type: 'draw' }).ok, 'not your turn');
  for (let i = 0; i < 8; i++) s.players[1].hand.push(card('dream', 1));
  assert.ok(!E.applyAction(s, 1, { type: 'draw' }).ok, 'hand full');
});

test('numbered Dream only fits its own slot; Jolly fits any', () => {
  const s = setup();
  const d3 = card('dream', 3), dj = card('dream', 'jolly');
  s.players[0].hand.push(d3, dj);
  assert.ok(!play(s, 0, d3, 'own', 0).ok);
  assert.deepEqual(E.targetsFor(s, 0, d3).map((t) => t.slot), [2]);
  assert.equal(E.targetsFor(s, 0, dj).length, 6);
  assert.ok(play(s, 0, d3, 'own', 2).ok);
  assert.equal(s.players[0].board[2], d3);
});

test('Dream overwrites own Nightmare and own duplicate Dream, but not own REM', () => {
  const s = setup();
  const d2 = card('dream', 2), d4 = card('dream', 4), d5 = card('dream', 5);
  s.players[0].hand.push(d2, d4, d5);
  s.players[0].board[1] = card('nightmare', 2);
  s.players[0].board[3] = card('dream', 4);
  s.players[0].board[4] = card('rem');
  assert.ok(!play(s, 0, d5, 'own', 4).ok, 'own REM is protected');
  assert.ok(play(s, 0, d2, 'own', 1).ok);
  assert.equal(s.players[0].board[1], d2);
  s.turn = 0;
  assert.ok(play(s, 0, d4, 'own', 3).ok);
  assert.equal(s.players[0].board[3], d4);
  assert.equal(s.discardCount, 2);
});

test('REM goes on any empty or Nightmare slot of your own, never on a Dream', () => {
  const s = setup();
  const rem = card('rem');
  s.players[0].hand.push(rem);
  s.players[0].board[0] = card('dream', 1);
  s.players[0].board[1] = card('nightmare', 'jolly');
  assert.deepEqual(E.targetsFor(s, 0, rem).map((t) => t.slot), [1, 2, 3, 4, 5]);
  assert.ok(E.targetsFor(s, 0, rem).every((t) => t.side === 'own'));
});

test('REM swap-steal: matching Dream stays in their slot, REM comes to my hand', () => {
  const s = setup();
  const d4 = card('dream', 4), d2 = card('dream', 2), rem = card('rem');
  s.players[0].hand.push(d4, d2);
  s.players[1].board[3] = rem;
  assert.ok(!play(s, 0, d2, 'opp', 3).ok, 'number must match');
  assert.ok(play(s, 0, d4, 'opp', 3).ok);
  assert.equal(s.players[1].board[3], d4);
  assert.ok(s.players[0].hand.includes(rem));
  assert.equal(s.event.kind, 'swap');
});

test('Nightmare steals a matching Dream into hand and stays in the slot', () => {
  const s = setup();
  const n3 = card('nightmare', 3), nj = card('nightmare', 'jolly');
  const d3 = card('dream', 3), dj = card('dream', 'jolly');
  s.players[0].hand.push(n3, nj);
  s.players[1].board[2] = d3;
  s.players[1].board[5] = dj;
  assert.ok(!play(s, 0, n3, 'opp', 0).ok, 'empty slot is forbidden');
  assert.ok(play(s, 0, n3, 'opp', 2).ok);
  assert.equal(s.players[1].board[2], n3);
  assert.ok(s.players[0].hand.includes(d3));
  s.turn = 0;
  assert.ok(!play(s, 0, nj, 'opp', 2).ok, 'slot already holds a Nightmare');
  assert.ok(play(s, 0, nj, 'opp', 5).ok);
  const stolen = s.players[0].hand.find((c) => c.id === dj.id);
  assert.equal(stolen.value, 'jolly');
  assert.equal(E.filledCount(s.players[1]), 0);
});

test('REM is immune to Nightmares unless the rule toggle is on', () => {
  let s = setup();
  const n1 = card('nightmare', 1);
  s.players[0].hand.push(n1);
  s.players[1].board[0] = card('rem');
  assert.ok(!play(s, 0, n1, 'opp', 0).ok);
  s = setup({ remSteal: true });
  s.players[0].hand.push(n1);
  const rem = card('rem');
  s.players[1].board[0] = rem;
  assert.ok(play(s, 0, n1, 'opp', 0).ok);
  assert.ok(s.players[0].hand.includes(rem));
});

test('discard only with 8 cards in hand', () => {
  const s = setup();
  for (let i = 0; i < 7; i++) s.players[0].hand.push(card('nightmare', 1));
  const c = s.players[0].hand[0];
  assert.ok(!E.applyAction(s, 0, { type: 'discard', cardId: c.id }).ok);
  s.players[0].hand.push(card('nightmare', 2));
  assert.ok(E.applyAction(s, 0, { type: 'discard', cardId: c.id }).ok);
  assert.equal(s.players[0].hand.length, 7);
  assert.equal(s.discardTop, c);
});

test('win: six slots of Dream/Jolly/REM; a Nightmare slot does not count', () => {
  const s = setup();
  const b = s.players[0].board;
  b[0] = card('dream', 1); b[1] = card('dream', 'jolly'); b[2] = card('rem');
  b[3] = card('dream', 4); b[4] = card('dream', 5); b[5] = card('nightmare', 6);
  const d6 = card('dream', 6);
  s.players[0].hand.push(d6);
  assert.equal(s.winner, null);
  assert.ok(play(s, 0, d6, 'own', 5).ok);
  assert.equal(s.winner, 0);
  assert.ok(!E.applyAction(s, 1, { type: 'draw' }).ok, 'game over');
});

test('view hides opponent hand values and the draw pile value, keeps the backs', () => {
  const s = E.newGame();
  const v = E.viewFor(s, 0);
  assert.ok(v.players[1].hand.every((c) => c.hidden && c.value === undefined && c.type));
  assert.ok(v.players[0].hand.every((c) => !c.hidden));
  assert.ok(v.top.hidden && v.top.type === s.top.type && v.top.value === undefined);
  s.turn = 1;
  E.applyAction(s, 1, { type: 'draw' });
  const v2 = E.viewFor(s, 0);
  assert.ok(v2.event.card.hidden && v2.event.moves[0].card.hidden);
  assert.ok(!JSON.stringify(E.viewFor(s, 1).event).includes('hidden'));
});

test('bot: takes the win, steals REM, blocks a near-win, fills slots, draws', () => {
  let s = setup();
  s.turn = 1;
  const b = s.players[1].board;
  for (let i = 0; i < 5; i++) b[i] = card('dream', i + 1);
  const d6 = card('dream', 6);
  s.players[1].hand.push(card('nightmare', 1), d6);
  s.players[0].board[0] = card('dream', 1);
  assert.equal(Bot.choose(s, 1).cardId, d6.id);

  s = setup(); s.turn = 1;
  const d2 = card('dream', 2);
  s.players[1].hand.push(d2, card('dream', 5));
  s.players[0].board[1] = card('rem');
  let a = Bot.choose(s, 1);
  assert.deepEqual([a.kind, a.cardId], ['swap', d2.id]);

  s = setup(); s.turn = 1;
  for (let i = 0; i < 5; i++) s.players[0].board[i] = card('dream', i + 1);
  s.players[1].hand.push(card('nightmare', 3), card('dream', 1));
  assert.equal(Bot.choose(s, 1).kind, 'steal');

  s = setup(); s.turn = 1;
  s.players[1].hand.push(card('dream', 1), card('nightmare', 3));
  assert.equal(Bot.choose(s, 1).kind, 'place');

  s = setup(); s.turn = 1;
  s.players[1].hand.push(card('nightmare', 3));
  assert.equal(Bot.choose(s, 1).type, 'draw');
});

test('500 bot-vs-bot games always finish with legal moves and hands <= 8', () => {
  let total = 0;
  for (let g = 0; g < 500; g++) {
    const s = E.newGame({ nightmareStealsRem: g % 2 === 0 });
    let turns = 0;
    while (s.winner === null) {
      const a = Bot.choose(s, s.turn);
      assert.ok(a, 'a player must never be stuck without a legal action');
      assert.ok(E.applyAction(s, s.turn, a).ok);
      assert.ok(s.players.every((p) => p.hand.length <= 8));
      assert.ok(++turns < 5000, 'game did not terminate');
    }
    assert.equal(E.filledCount(s.players[s.winner]), 6);
    total += turns;
  }
  console.log('        average game length: ' + (total / 500).toFixed(1) + ' turns');
});

test('bot levels: every level plays whole games with legal moves', () => {
  for (const level of Bot.LEVELS) {
    for (let g = 0; g < 100; g++) {
      const s = E.newGame({ nightmareStealsRem: g % 2 === 0 });
      const bots = [Bot.create(level), Bot.create('normal')];
      let turns = 0;
      while (s.winner === null) {
        const a = bots[s.turn].choose(s, s.turn);
        assert.ok(a, level + ' bot must never be stuck');
        assert.ok(E.applyAction(s, s.turn, a).ok);
        bots.forEach((bot, seat) => bot.observe(s, seat));
        assert.ok(++turns < 5000, 'game did not terminate');
      }
    }
  }
  assert.equal(Bot.create('nonsense').level, 'normal');
});

test('bot levels: hard keeps back a Dream it has seen the Nightmare for, nightmare peeks', () => {
  // The opponent holds a Nightmare 4 that the bot saw them take off its board.
  const rig = (level, sawIt) => {
    const s = setup(); s.turn = 1;
    const n4 = card('nightmare', 4);
    s.players[0].hand.push(n4);
    s.players[1].hand.push(card('dream', 4));
    const bot = Bot.create(level);
    if (sawIt) { s.event = { kind: 'steal', seat: 0, taken: n4 }; bot.observe(s, 1); }
    return bot.choose(s, 1);
  };
  assert.equal(rig('hard', true).type, 'draw');   // they would take it straight back: wait
  assert.equal(rig('normal', true).kind, 'place');

  // An opponent's draw is only remembered by the nightmare bot.
  const drawn = (level) => {
    const s = setup(); s.turn = 1;
    const n4 = card('nightmare', 4);
    s.players[0].hand.push(n4);
    s.players[1].hand.push(card('dream', 4));
    const bot = Bot.create(level);
    s.event = { kind: 'draw', seat: 0, card: n4 };
    bot.observe(s, 1);
    return bot.choose(s, 1);
  };
  assert.equal(drawn('nightmare').type, 'draw');
  assert.equal(drawn('hard').kind, 'place'); // one unseen Nightmare is a risk worth taking

  // Hard still takes the win, whatever the risk.
  const s = setup(); s.turn = 1;
  for (let i = 0; i < 5; i++) s.players[1].board[i] = card('dream', i + 1);
  const d6 = card('dream', 6), n6 = card('nightmare', 6);
  s.players[1].hand.push(d6);
  s.players[0].hand.push(n6);
  const bot = Bot.create('hard');
  s.event = { kind: 'steal', seat: 0, taken: n6 }; bot.observe(s, 1);
  assert.equal(bot.choose(s, 1).cardId, d6.id);
});

console.log('\n' + n + ' tests passed');

// Dream — serverless 2-player link over PeerJS (WebRTC). The host is authoritative.
(function (root) {
  const D = (root.Dream = root.Dream || {});
  const PREFIX = 'dreamcards-room-';
  const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no look-alikes (0/O, 1/I/L)

  function randomCode() {
    let code = '';
    for (let i = 0; i < 5; i++) code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    return code;
  }

  // cb(event, payload): 'open' (host: room code), 'connected', 'data', 'closed', 'error' (message)
  function create(role, code, cb) {
    let peer = null;
    let conn = null;
    let closed = false;
    const emit = cb;
    cb = (ev, data) => { if (!closed) emit(ev, data); }; // a cancelled room or join stays silent
    const api = {
      code: null,
      send(msg) { if (conn && conn.open) conn.send(msg); },
      close() {
        api.send({ t: 'bye' });
        closed = true;
        clearInterval(beat);
        const p = peer; // give the goodbye a moment to leave before tearing down
        setTimeout(() => { try { if (p) p.destroy(); } catch (e) { /* already gone */ } }, 250);
      },
    };
    if (typeof root.Peer !== 'function') {
      setTimeout(() => cb('error', 'Online play is unavailable (PeerJS failed to load).'), 0);
      return api;
    }

    // WebRTC can take half a minute to notice a vanished peer, so both sides also
    // say goodbye on page close and keep a small heartbeat going.
    let lastSeen = 0;
    let beat = 0;
    let dropped = false;
    function drop() {
      if (dropped) return;
      dropped = true;
      clearInterval(beat);
      if (!closed) cb('closed');
    }
    function wire(c) {
      conn = c;
      c.on('open', () => {
        lastSeen = Date.now();
        beat = setInterval(() => {
          if (Date.now() - lastSeen > 20000) drop();
          else api.send({ t: 'ping' });
        }, 4000);
        cb('connected');
      });
      c.on('data', (d) => {
        lastSeen = Date.now();
        if (d && d.t === 'ping') return;
        if (d && d.t === 'bye') { drop(); return; }
        cb('data', d);
      });
      c.on('close', drop);
      c.on('error', drop);
    }
    root.addEventListener('pagehide', () => api.send({ t: 'bye' }));

    function describe(err) {
      if (err.type === 'peer-unavailable') return 'Room not found. Check the code and try again.';
      if (err.type === 'network' || err.type === 'server-error' || err.type === 'socket-error') {
        return 'Could not reach the matchmaking server. Check your connection.';
      }
      if (err.type === 'browser-incompatible') return 'This browser does not support WebRTC.';
      return 'Connection error (' + (err.type || 'unknown') + ').';
    }

    if (role === 'host') {
      const open = (tries) => {
        api.code = randomCode();
        peer = new root.Peer(PREFIX + api.code);
        peer.on('open', () => cb('open', api.code));
        peer.on('connection', (c) => {
          if (conn && conn.open) { // room is already full
            c.on('open', () => { c.send({ t: 'full' }); setTimeout(() => c.close(), 400); });
            return;
          }
          wire(c);
        });
        peer.on('disconnected', () => {
          // keep the room findable if the signalling socket drops (retry later, never synchronously)
          const p = peer;
          setTimeout(() => { if (!closed && p === peer && !p.destroyed && p.disconnected) p.reconnect(); }, 2000);
        });
        peer.on('error', (err) => {
          if (err.type === 'unavailable-id' && tries < 5) { peer.destroy(); open(tries + 1); }
          else if (!closed) cb('error', describe(err));
        });
      };
      open(0);
    } else {
      api.code = String(code || '').trim().toUpperCase();
      peer = new root.Peer();
      peer.on('open', () => wire(peer.connect(PREFIX + api.code, { reliable: true })));
      peer.on('error', (err) => { if (!closed) cb('error', describe(err)); });
    }
    return api;
  }

  D.Net = { create };
})(typeof globalThis !== 'undefined' ? globalThis : this);

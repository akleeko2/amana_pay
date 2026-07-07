/**
 * Amana Pay — Realtime (WebSocket) Hub
 * -----------------------------------------------------------------------------
 * طبقة بث خفيفة فوق `ws`. تتيح للخدمات إرسال تحديثات حية لصفحة الدفع
 * والـ Dashboard (مثل تأكيد الدفع) عبر القنوات (channels).
 *
 * بروتوكول العميل: يرسل {"type":"subscribe","channel":"payment:<id>"}.
 * الخادم يبث: {"type":"<event>","channel":"<channel>","data":{...}}.
 */
'use strict';

const { WebSocketServer } = require('ws');

let wss = null;

function attach(httpServer) {
  wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws) => {
    ws.channels = new Set();
    ws.isAlive = true;

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (msg && msg.type === 'subscribe' && typeof msg.channel === 'string') {
        ws.channels.add(msg.channel);
        ws.send(JSON.stringify({ type: 'subscribed', channel: msg.channel }));
      } else if (msg && msg.type === 'unsubscribe' && typeof msg.channel === 'string') {
        ws.channels.delete(msg.channel);
      }
    });

    ws.send(JSON.stringify({ type: 'connected', data: { service: 'amana-pay' } }));
  });

  // فحص حيوية الاتصالات كل 30 ثانية
  const interval = setInterval(() => {
    if (!wss) return;
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => clearInterval(interval));
  return wss;
}

/** بث رسالة لكل المشتركين في قناة معيّنة. */
function broadcast(channel, type, data = {}) {
  if (!wss) return 0;
  const payload = JSON.stringify({ type, channel, data, ts: Date.now() });
  let sent = 0;
  wss.clients.forEach((ws) => {
    if (ws.readyState === ws.OPEN && ws.channels && ws.channels.has(channel)) {
      ws.send(payload);
      sent += 1;
    }
  });
  return sent;
}

function clientCount() {
  return wss ? wss.clients.size : 0;
}

module.exports = { attach, broadcast, clientCount };

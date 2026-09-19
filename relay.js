const { WebSocketServer } = require("ws");
const PORT = process.env.PORT || 8080;
const TOKEN = process.env.TOKEN || "change-me";

const wss = new WebSocketServer({ port: PORT });
const clients = new Map();

function broadcast(obj, except) {
  const raw = JSON.stringify(obj);
  for (const [ws] of clients) {
    if (ws !== except && ws.readyState === 1) ws.send(raw);
  }
}

function rosterList() {
  const seen = new Map();
  for (const [, info] of clients) {
    if (info.name) seen.set(info.name, info.uid);
  }
  return Array.from(seen.entries()).map(([name, uid]) => ({ name, uid }));
}

function broadcastRoster() {
  broadcast({ type: "roster", users: rosterList() });
}

wss.on("connection", (ws, req) => {
  const url = new URL(req.url, "http://x");
  if (url.searchParams.get("token") !== TOKEN) {
    ws.close(1008, "bad token");
    return;
  }
  clients.set(ws, { name: null, uid: 0 });

  ws.on("message", (raw) => {
    let data;
    try { data = JSON.parse(raw.toString()); } catch { return; }
    const info = clients.get(ws);
    if (!info) return;

    if (data.type === "hello") {
      info.name = String(data.name || "?").slice(0, 32);
      info.uid = Number(data.uid) || 0;
      broadcastRoster();
      return;
    }
    if (!info.name) return;

    if (data.type === "msg") {
      const text = String(data.text || "");
      if (!text || text.length > 200) return;
      broadcast({
        type: "msg",
        name: info.name,
        uid: info.uid,
        text: text,
        t: Date.now(),
      });
    } else if (data.type === "typing") {
      broadcast({ type: "typing", name: info.name }, ws);
    } else if (data.type === "react") {
      const emoji = String(data.emoji || "").slice(0, 8);
      const target = Number(data.target_t) || 0;
      if (!emoji || !target) return;
      broadcast({
        type: "react",
        name: info.name,
        target_t: target,
        emoji: emoji,
      });
    }
  });

  ws.on("close", () => {
    clients.delete(ws);
    broadcastRoster();
  });
});

console.log(`relay on :${PORT}`);

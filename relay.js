// npm i ws
const { WebSocketServer } = require("ws");
const PORT = process.env.PORT || 8080;
const TOKEN = process.env.TOKEN || "change-me";

const wss = new WebSocketServer({ port: PORT });
const clients = new Set();

wss.on("connection", (ws, req) => {
  const url = new URL(req.url, "http://x");
  if (url.searchParams.get("token") !== TOKEN) {
    ws.close(1008, "bad token");
    return;
  }
  clients.add(ws);
  console.log(`+ ${clients.size} connected`);

  ws.on("message", (raw) => {
    let data;
    try { data = JSON.parse(raw.toString()); } catch { return; }
    if (typeof data.text !== "string" || data.text.length > 200) return;
    const out = JSON.stringify({
      name: String(data.name || "?").slice(0, 32),
      text: data.text,
      t: Date.now(),
      uid: Number(data.uid) || 0,
    });
    for (const c of clients) {
      if (c.readyState === 1) c.send(out);
    }
  });

  ws.on("close", () => {
    clients.delete(ws);
    console.log(`- ${clients.size} connected`);
  });
});

console.log(`relay on :${PORT}`);

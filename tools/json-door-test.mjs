// Checks the JSON door (server/src/jsonGateway.ts) the way the Godot app uses it:
// join with a new account, "ready", put the robe on, walk to a clicked spot, talk to Keeper Celene.
// Start the server first (npm run dev, or: cd server && npx tsx src/index.ts), then: node tools/json-door-test.mjs
const ws = new WebSocket("ws://127.0.0.1:2567/json");
let sid, me, bag, dialogs = [], msgs = [];
ws.onmessage = (e) => { const m = JSON.parse(e.data);
  if (m.op === "joined") sid = m.sessionId;
  if (m.op === "error") console.log("error", m.message);
  if (m.op === "state" && m.players?.[sid]) me = m.players[sid];
  if (m.op === "msg" && m.type === "bag") bag = m.data;
  if (m.op === "msg" && (m.type === "dialog" || m.type === "intro")) dialogs.push(m.data.name + ": " + m.data.lines[0].slice(0, 80));
  if (m.op === "msg" && m.type === "message") msgs.push(String(m.data).slice(0, 90)); };
const send = (type, data) => ws.send(JSON.stringify({ op: "send", type, data }));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
ws.onopen = () => ws.send(JSON.stringify({ op: "join", username: "gd" + Math.floor(Math.random() * 9999), password: "secret123", create: true }));
await wait(1500); send("ready", {}); await wait(1200);
bag.inventory.forEach((it, i) => { if (it && it.endsWith("_cloth")) send("wear", { slot: i }); });
await wait(1000);
console.log("start", me.x, me.y);
send("move", { x: me.x + 3, y: me.y, fx: me.x + 3.4, fy: me.y + 0.6 });
await wait(4000);
console.log("after move", me.x, me.y, me.fx.toFixed(2), me.fy.toFixed(2));
send("talk", { id: "celene" });
await wait(6000);
console.log("after talk at", me.x, me.y); console.log("dialogs:", dialogs); console.log("msgs:", msgs.slice(-4));
ws.close(); process.exit(0);

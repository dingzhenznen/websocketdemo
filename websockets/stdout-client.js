const WebSocket = require("ws");

const PORT = Number(process.env.PORT || 8091);
const URL = process.env.WS_URL || `ws://127.0.0.1:${PORT}`;

const socket = new WebSocket(URL);

socket.on("open", () => {
  console.log(`connected: ${URL}`);
});

socket.on("message", (data) => {
  const text = data.toString();
  console.log(`received raw: ${text}`);

  let frame;
  try {
    frame = JSON.parse(text);
  } catch {
    return;
  }

  if (frame.type === "ready") {
    console.log("ready1111");
    socket.send(JSON.stringify({ type: "start" }));
  }
});

socket.on("close", (code, reason) => {
  console.log(`disconnected: code=${code} reason=${reason.toString()}`);
});

socket.on("error", (error) => {
  console.error("socket error:", error.message);
});

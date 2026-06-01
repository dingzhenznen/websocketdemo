const WebSocket = require("ws");

const PORT = Number(process.env.PORT || 8090);
const URL = process.env.WS_URL || `ws://127.0.0.1:${PORT}`;

const socket = new WebSocket(URL);

socket.on("open", () => {
  console.log(`connected: ${URL}`);
  socket.send("hello from node client");
});

socket.on("message", (data) => {
  console.log(`received: ${data.toString()}`);
});

socket.on("close", () => {
  console.log("disconnected");
});

socket.on("error", (error) => {
  console.error("socket error:", error.message);
});

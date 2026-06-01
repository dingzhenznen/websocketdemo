/// 同时支持http 和 ws

const http = require("http");
const WebSocket = require("ws");

const server = http.createServer((req, res) => {
  if (req.url === "/") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end("hello");
    return;
  }

  res.writeHead(404);
  res.end();
});

const wss = new WebSocket.Server({ server });

wss.on("connection", (socket) => {
  socket.send("connected");
});

server.listen(8092, () => {
  console.log("http + ws listening on 8092");
});
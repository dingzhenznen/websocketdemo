const http = require("http");
const WebSocket = require("ws");

const server = http.createServer((req, res) => {
  res.end("ok");
});

const wss = new WebSocket.Server({ noServer: true });

server.on("upgrade", (req, socket, head) => {
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit("connection", ws, req);
  });
});


// { noServer: true }：更灵活，适合你要按路径、鉴权、子协议、多个 WebSocket 服务做分流
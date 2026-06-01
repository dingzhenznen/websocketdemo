const Koa = require("koa");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { Server } = require("socket.io");

const app = new Koa();
const PORT = Number(process.env.PORT || 3009);
const HTML_PATH = path.join(__dirname, "socket.html");

app.use(async (ctx) => {
  if (ctx.path === "/" || ctx.path === "/socket.html") {
    ctx.type = "html";
    ctx.body = fs.readFileSync(HTML_PATH, "utf8");
    return;
  }

  ctx.body = "Socket.IO server is running.";
});

const server = http.createServer(app.callback());
const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

io.on("connection", (socket) => {
  console.log(`client connected: ${socket.id}`);

  socket.emit("eventA", {
    message: "connected to server",
    socketId: socket.id
  });

  socket.on("eventB", (payload) => {
    console.log("received eventB:", payload);

    io.emit("eventA", {
      message: "broadcast from server",
      from: socket.id,
      payload
    });
  });

  socket.on("disconnect", () => {
    console.log(`client disconnected: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  console.log(`Socket.IO app listening on http://127.0.0.1:${PORT}`);
});

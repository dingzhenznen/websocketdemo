const WebSocket = require("ws");

const PORT = Number(process.env.PORT || 8090);
const wss = new WebSocket.Server({ port: PORT });

wss.on("listening", () => {
  console.log(`WebSocket server listening on ws://127.0.0.1:${PORT}`);
});

wss.on("connection", (socket, request) => {
  console.log(`client connected from ${request.socket.remoteAddress}`);

  socket.send(
    JSON.stringify({
      type: "welcome",
      message: "connected to websocket server",
      time: new Date().toISOString()
    })
  );

  socket.on("message", (data) => {
    const text = data.toString();
    console.log(`received: ${text}`);

    socket.send(
      JSON.stringify({
        type: "echo",
        message: text,
        time: new Date().toISOString()
      })
    );
  });

  socket.on("close", () => {
    console.log("client disconnected");
  });

  socket.on("error", (error) => {
    console.error("socket error:", error.message);
  });
});

wss.on("error", (error) => {
  console.error("server error:", error.message);
  process.exit(1);
});

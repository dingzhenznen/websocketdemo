const { client: WebSocketClient } = require("websocket");

const PORT = Number(process.env.PORT || 8080);
const URL = process.env.WS_URL || `ws://127.0.0.1:${PORT}/`;

const client = new WebSocketClient();

client.on("connectFailed", (error) => {
  console.log(`Connect Error: ${error.toString()}`);
});

client.on("connect", (connection) => {
  console.log("WebSocket Client Connected");

  connection.on("error", (error) => {
    console.log(`Connection Error: ${error.toString()}`);
  });

  connection.on("close", () => {
    console.log("echo-protocol Connection Closed");
  });

  connection.on("message", (message) => {
    if (message.type === "utf8") {
      console.log(`Received: '${message.utf8Data}'`);
    }
  });

  function sendNumber() {
    if (!connection.connected) {
      return;
    }

    const number = Math.round(Math.random() * 0xffffff);
    connection.sendUTF(number.toString());
    setTimeout(sendNumber, 1000);
  }

  sendNumber();
});

client.connect(URL, "echo-protocol");

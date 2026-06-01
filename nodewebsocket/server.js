const http = require("http");
const fs = require("fs");
const path = require("path");
const { server: WebSocketServer } = require("websocket");

const PORT = Number(process.env.PORT || 8080);
const HTML_PATH = path.join(__dirname, "socket.html");

function originIsAllowed(origin) {
  return true;
}

const server = http.createServer((request, response) => {
  if (request.url === "/" || request.url === "/socket.html") {
    const html = fs.readFileSync(HTML_PATH, "utf8");
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(html);
    return;
  }

  console.log(`${new Date().toISOString()} Received request for ${request.url}`);
  response.writeHead(404);
  response.end();
});

server.listen(PORT, () => {
  console.log(`${new Date().toISOString()} Server is listening on port ${PORT}`);
});

const wsServer = new WebSocketServer({
  httpServer: server,
  autoAcceptConnections: false
});

wsServer.on("request", (request) => {
  if (!originIsAllowed(request.origin)) {
    request.reject();
    console.log(`${new Date().toISOString()} Connection from origin ${request.origin} rejected.`);
    return;
  }

  const connection = request.accept("echo-protocol", request.origin);
  console.log(`${new Date().toISOString()} Connection accepted from ${connection.remoteAddress}.`);

  connection.on("message", (message) => {
    if (message.type === "utf8") {
      console.log(`Received Message: ${message.utf8Data}`);
      connection.sendUTF(message.utf8Data);
      return;
    }

    if (message.type === "binary") {
      console.log(`Received Binary Message of ${message.binaryData.length} bytes`);
      connection.sendBytes(message.binaryData);
    }
  });

  connection.on("close", () => {
    console.log(`${new Date().toISOString()} Peer ${connection.remoteAddress} disconnected.`);
  });
});

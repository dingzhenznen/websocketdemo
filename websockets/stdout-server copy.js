const { spawn } = require("node:child_process");
const { PassThrough } = require("node:stream");
const WebSocket = require("ws");

// 模仿k8s.exec的行为，启动一个子进程，并将stdout、stderr通过WebSocket发送给客户端，直到子进程退出或出错

const PORT = Number(process.env.PORT || 8091);
const wss = new WebSocket.Server({ port: PORT });

function sendJson(socket, payload) {
  socket.send(JSON.stringify(payload));
}

function startDemoProcess(socket) {
  const child = spawn(process.execPath, ["-e", `
let count = 0;
const timer = setInterval(() => {
  count += 1;
  console.log("stdout line " + count);
  if (count === 2) {
    console.error("stderr line " + count);
  }
  if (count >= 5) {
    clearInterval(timer);
    process.exit(0);
  }
}, 700);
`], {
    stdio: ["pipe", "pipe", "pipe"]
  });

  // 创建 PassThrough 流作为中间层
  const stdoutPass = new PassThrough();
  const stderrPass = new PassThrough();

  // 将子进程输出导入 PassThrough
  child.stdout.pipe(stdoutPass);
  child.stderr.pipe(stderrPass);

  // 监听 PassThrough 的事件
  stdoutPass.on("data", (chunk) => {
    console.log("[PassThrough stdout] received:", chunk.toString().trim());
    if (socket.readyState === WebSocket.OPEN) {
      sendJson(socket, { type: "stdout", data: chunk.toString() });
    }
  });

  stderrPass.on("data", (chunk) => {
    console.log("[PassThrough stderr] received:", chunk.toString().trim());
    if (socket.readyState === WebSocket.OPEN) {
      sendJson(socket, { type: "stderr", data: chunk.toString() });
    }
  });

  // 监听 PassThrough 的其他事件
  stdoutPass.on("end", () => {
    console.log("[PassThrough stdout] ended");
  });

  stderrPass.on("end", () => {
    console.log("[PassThrough stderr] ended");
  });

  stdoutPass.on("error", (error) => {
    console.error("[PassThrough stdout] error:", error.message);
  });

  stderrPass.on("error", (error) => {
    console.error("[PassThrough stderr] error:", error.message);
  });

  child.on("close", (code) => {
    console.log(`[Child process] exited with code ${code}`);
    if (socket.readyState === WebSocket.OPEN) {
      sendJson(socket, { type: "status", code });
      socket.close(1000, "process finished");
    }
  });

  child.on("error", (error) => {
    console.error("[Child process] error:", error.message);
    if (socket.readyState === WebSocket.OPEN) {
      sendJson(socket, { type: "error", message: error.message });
      socket.close(1011, "process error");
    }
  });

  return child;
}

wss.on("listening", () => {
  console.log(`stdout demo server listening on ws://127.0.0.1:${PORT}`);
});

wss.on("connection", (socket, request) => {
  console.log(`client connected from ${request.socket.remoteAddress}`);
  sendJson(socket, {
    type: "ready",
    message: "send {\"type\":\"start\"} to stream stdout"
  });

  let child;

  socket.on("message", (data) => {
    let frame;
    console.log(`onmessage: ${data.toString()}`);
    try {
      frame = JSON.parse(data.toString());
    } catch {
      sendJson(socket, { type: "error", message: "invalid json" });
      return;
    }

    if (frame.type === "start") {
      if (child) {
        sendJson(socket, { type: "error", message: "process already started" });
        return;
      }
      sendJson(socket, { type: "started" });
      console.log("starting111111");
      child = startDemoProcess(socket);
      return;
    }

    if (frame.type === "stdin") {
      if (!child) {
        sendJson(socket, { type: "error", message: "start the process first" });
        return;
      }
      child.stdin.write(String(frame.data || ""));
      return;
    }

    sendJson(socket, { type: "error", message: `unknown frame type: ${frame.type}` });
  });

  socket.on("close", () => {
    if (child && !child.killed) {
      child.kill("SIGTERM");
    }
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
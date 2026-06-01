# Pure WebSocket Demo

这个 demo 只启动 WebSocket 服务，不返回 HTTP 页面。

包含：

- `server.js`: 纯 `ws` 服务端
- `client.js`: Node 客户端
- `stdout-server.js`: 模拟 `k8s exec`/子进程 stdout 持续回传的服务端
- `stdout-client.js`: 接收 `stdout`/`stderr`/`status` 帧的 Node 客户端
- `socket.html`: 浏览器客户端，可直接双击打开

## 安装

```bash
pnpm install
```

## 启动服务端

```bash
pnpm run server
```

## 启动 Node 客户端

```bash
pnpm run client
```

## `stdout` 流式示例

这个例子模拟：

- WebSocket 建连后先返回 `ready`
- 客户端发送 `{ "type": "start" }`
- 服务端启动一个子进程
- 子进程的 `stdout` / `stderr` 持续通过 WebSocket 发回客户端
- 进程结束后返回 `status`

启动服务端：

```bash
pnpm run stdout-server
```

启动客户端：

```bash
pnpm run stdout-client
```

你会看到类似输出：

```text
{"type":"ready","message":"send {\"type\":\"start\"} to stream stdout"}
{"type":"started"}
{"type":"stdout","data":"stdout line 1\n"}
{"type":"stdout","data":"stdout line 2\n"}
{"type":"stderr","data":"stderr line 2\n"}
{"type":"status","code":0}
```

这和 `sealos-tty-bridge` / `k8s.Exec` 的模式是同一类思路：

- 前端一条 WebSocket
- 后端接一个会持续产生输出的进程/exec 通道
- 把输出分帧再通过 WebSocket 返回

## 浏览器测试

直接打开 `socket.html`，点击“连接”即可。

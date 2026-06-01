# Pure WebSocket Demo

这个 demo 只启动 WebSocket 服务，不返回 HTTP 页面。

包含：

- `server.js`: 纯 `ws` 服务端
- `client.js`: Node 客户端
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

## 浏览器测试

直接打开 `socket.html`，点击“连接”即可。

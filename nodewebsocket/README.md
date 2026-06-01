# WebSocket-Node Demo

这个 demo 按 `theturtle32/WebSocket-Node` README 里的官方例子实现：

- `server.js`: Echo WebSocket 服务端
- `client.js`: Node 客户端，连接后每秒发送一个随机数

## 安装依赖

```bash
pnpm install
```

## 启动服务端

```bash
pnpm run server
```

## 启动客户端

```bash
pnpm run client
```

## 可选环境变量

```bash
PORT=8081 pnpm run server
PORT=8081 pnpm run client
```


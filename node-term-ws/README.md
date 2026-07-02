# node-term-ws

一个不使用 PTY 的终端风格 demo。

- 前端：`xterm.js`
- 后端：`express + ws`
- 命令执行：`child_process.spawn`

## 交互模型

这不是持续 shell 会话。

- 用户在前端输入一整行命令
- 按回车后，前端通过 WebSocket 发送 `{ type: "run", command }`
- 服务端使用子进程执行该命令
- `stdout` / `stderr` 实时推回前端
- 子进程退出后，前端重新显示提示符

因此每次执行都是一个新的命令进程，不共享 shell 上下文。

例如：

- `pwd` 可以执行
- `cd /tmp` 会在那个子进程里执行，但不会影响下一条命令的工作目录

## 运行

```bash
npm install
npm start
```

默认地址：

```txt
http://127.0.0.1:3001
```

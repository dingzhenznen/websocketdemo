
const http = require('http');

const req = http.request("http://localhost:8098");

req.on('error', (e) => {
  console.error(`请求遇到问题: ${e.message}`);
});

// 写入数据到请求主体
req.end();

req.on('response', (res) => {
  console.log(`状态码: ${res.statusCode}`);
  console.log(`响应头: ${JSON.stringify(res.headers)}`);

  res.on('data', (chunk) => {
    console.log('响应数据:', chunk.toString());
  });

  res.on('end', () => {
    console.log('响应接收完毕');
  });
});


// ┌────────────┬──────────────────────────────────┬────────────────────────────┐
// │   事件名   │             触发时机             │          使用场景          │
// ├────────────┼──────────────────────────────────┼────────────────────────────┤
// │ 'response' │ 收到 HTTP 响应头时               │ 普通 HTTP 请求 ✅          │
// ├────────────┼──────────────────────────────────┼────────────────────────────┤
// │ 'connect'  │ CONNECT 方法建立隧道后           │ HTTPS 代理、WebSocket 升级 │
// ├────────────┼──────────────────────────────────┼────────────────────────────┤
// │ 'upgrade'  │ 协议升级时（如升级到 WebSocket） │ WebSocket 客户端           │
// └────────────┴──────────────────────────────────┴────────────────────────────┘


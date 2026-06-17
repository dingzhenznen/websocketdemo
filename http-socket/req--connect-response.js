
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


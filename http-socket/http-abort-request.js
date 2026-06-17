
const http = require('http');

const req = http.request("http://localhost:8098", (res) => {
  console.log(`状态码: ${res.statusCode}`);
  console.log(`响应头: ${JSON.stringify(res.headers)}`);
  res.setEncoding('utf8');
  res.on('data', (chunk) => {
    console.log(`响应主体: ${chunk}`);
  });
  res.on('end', () => {
    console.log('响应中已无数据。');
  });
});

req.on('error', (e) => {
  console.error(`请求遇到问题: ${e.message}`);
});

req.on("abort", () => {
  console.log("请求已被中止");
});



// 写入数据到请求主体
req.end();


setTimeout(() => {
  req.abort();
}, 1000);
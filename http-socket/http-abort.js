const http = require('http');

const server = http.createServer((req, res) => {
  console.log(req.url);
  // console.log(res);
 
  res.on('close', () => {
    // 注意：res 的 close 事件没有 err 参数
    console.log('res close - 响应流关闭');
    console.log('  res.writableEnded:', res.writableEnded);
    // writableEnded 为 false 表示客户端提前断开
  });

  req.on('close', () => {
    console.log('req close - 客户端连接关闭');
  });

  req.on('aborted', () => {
    // Node.js 旧版本有这个事件，新版本已弃用
    console.log('req aborted - 请求被中止');
  });

  req.on('aborted', () => {
    console.log('req aborted - 读取请求被中止');
  });  


  setTimeout(() => {
    res.end('ddd');
  }, 5000);

  // res.end('hello');

  
});
server.on('clientError', (err, socket) => {
  socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});
server.listen(8098);
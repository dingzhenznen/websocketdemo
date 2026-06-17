const http = require('http');
http.get('http://nodejs.org/dist/index.json', (res) => {
  const { statusCode } = res;
  console.log( res);
  const contentType = res.headers['content-type'];

  let error;
  if (statusCode !== 200) {
    error = new Error('请求失败。\n' +
                      `状态码: ${statusCode}`);
  } else if (!/^application\/json/.test(contentType)) {
    error = new Error('无效的 content-type.\n' +
                      `期望 application/json 但获取的是 ${contentType}`);
  }
  if (error) {
    console.error(error.message);
    // 消耗响应数据以释放内存
    res.resume();
    return;
  }

  res.setEncoding('utf8');
  let rawData = '';
  res.on('data', (chunk) => { 
    console.log(`数据块:111}`);
    rawData += chunk; 
  });
  res.on('end', () => {
    try {
      const parsedData = JSON.parse(rawData);

      // 将结果写入当前文件夹的 index.json 文件
      const fs = require('fs');
      const path = require('path');
      const outputPath = path.join(__dirname, 'index.json');

      fs.writeFile(outputPath, JSON.stringify(parsedData, null, 2), (err) => {
        if (err) {
          console.error('写入文件失败:', err.message);
        } else {
          console.log(`数据已写入: ${outputPath}`);
        }
      });

    } catch (e) {
      console.error(e.message);
    }
  });
}).on('error', (e) => {
  console.error(`错误: ${e.message}`);
});
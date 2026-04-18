// api/flowus.js
import axios from 'axios';

export default async function handler(req, res) {
  const code = req.query.code || req.body.code;

  console.log('Received OAuth code:', code);

  // TODO: 使用 code 换取 FlowUs access token
  // axios.post('https://flowus.cn/oauth/token', {...})

  res.status(200).send(`<html><body>
    <h2>授权完成！</h2>
    <p>收到 code: ${code}</p>
    <p>可以关闭浏览器回到客户端</p>
  </body></html>`);
}
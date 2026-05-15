const express = require('express');
const os = require('os');
const app = express();
 
const PORT = process.env.PORT || 3000;
const VERSION = process.env.APP_VERSION || '1.0.0';
const TARGET_GROUP = process.env.TARGET_GROUP || 'unknown';
const ENVIRONMENT = process.env.ENVIRONMENT || 'unknown';
let taskId = os.hostname();
if (process.env.ECS_CONTAINER_METADATA_URI_V4) {
  const http = require('http');
  http.get(`${process.env.ECS_CONTAINER_METADATA_URI_V4}/task`, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try { taskId = JSON.parse(data).TaskARN.split('/').pop(); } catch (e) {}
    });
  }).on('error', () => {});
}
 
app.get('/health', (req, res) => {
  res.json({
    status:      'ok',
    version:     VERSION,
    environment: ENVIRONMENT,
    targetGroup: TARGET_GROUP,
    message:     'Welcome on board! Stanley API is live on AWS ECS!',
    host:        os.hostname(),
    taskId:      taskId,
    containerId: os.hostname().split('.')[0],
  });
});
 
app.get('/', (req, res) => {
  res.send('<h1>Borderless Tech Academy API</h1><p>GET /health for status</p>');
});
 
app.listen(PORT, () => console.log(`Listening on port ${PORT}`));

const fs = require('fs');
const path = require('path');

// Determine wallet path from environment or default to ./wallet
const walletPath = process.env.WALLET_PATH || path.join(__dirname, 'wallet');

if (!fs.existsSync(walletPath)) {
  fs.mkdirSync(walletPath, { recursive: true });
}

console.log(`Using wallet directory: ${walletPath}`);

// Placeholder for server implementation
// e.g., Express or Fabric gateway initialization

const http = require('http');

function handleRequest(req, res) {
  // basic CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  if (req.method === 'POST' && req.url === '/api/share') {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        console.log('Received share request', data);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok' }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
  } else {
    res.writeHead(404);
    res.end();
  }
}

const port = process.env.PORT || 3001;
http.createServer(handleRequest).listen(port, () => {
  console.log('Server listening on port', port);
});

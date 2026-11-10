const { createServer } = require('node:http');

const server = createServer((request, response) => {
  const { pathname } = new URL(request.url, 'http://127.0.0.1');
  response.setHeader('content-type', 'application/json');

  if (pathname === '/health') {
    response.writeHead(200).end(JSON.stringify({ ok: true }));
    return;
  }

  if (pathname === '/auth/v1/user') {
    response.writeHead(401).end(JSON.stringify({
      code: 'bad_jwt',
      message: 'Invalid test token',
    }));
    return;
  }

  if (pathname === '/auth/v1/token') {
    response.writeHead(400).end(JSON.stringify({
      code: 'invalid_grant',
      message: 'Invalid test refresh token',
    }));
    return;
  }

  response.writeHead(404).end(JSON.stringify({ message: 'Not found' }));
});

server.listen(54321, '127.0.0.1');

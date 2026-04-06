import 'dotenv/config';
import http from 'http';
import { app } from './app.js';

const PORT = Number(process.env.PORT ?? 4000);

const server = http.createServer(app);

server.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
});

function shutdown(signal: string) {
  console.log(`[server] received ${signal}, shutting down gracefully`);
  server.close(() => {
    console.log('[server] closed');
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

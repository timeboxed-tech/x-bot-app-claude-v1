import * as jobWorker from './jobWorker.js';
import * as staleLockRecovery from './staleLockRecovery.js';
import * as postPublisher from './postPublisher.js';

let isShuttingDown = false;

function shutdown(signal: string): void {
  if (isShuttingDown) {
    console.log(`[worker] Received ${signal} again during shutdown, forcing exit`);
    process.exit(1);
  }

  isShuttingDown = true;
  console.log(`[worker] Received ${signal}. Shutting down gracefully...`);

  jobWorker.stop();
  staleLockRecovery.stop();
  postPublisher.stop();

  // Allow a short window for in-flight work to finish
  setTimeout(() => {
    console.log('[worker] Shutdown complete');
    process.exit(0);
  }, 5000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  console.error('[worker] Uncaught exception:', err);
  shutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  console.error('[worker] Unhandled rejection:', reason);
});

console.log('[worker] Starting worker processes...');

jobWorker.start();
staleLockRecovery.start();
postPublisher.start();

console.log('[worker] All worker processes started');

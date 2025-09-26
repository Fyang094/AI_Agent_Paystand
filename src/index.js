import ScheduleAgent from './app.js';

// Create and start the application
const app = new ScheduleAgent();

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nReceived SIGINT. Graceful shutdown...');
  await app.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nReceived SIGTERM. Graceful shutdown...');
  await app.stop();
  process.exit(0);
});

// Start the application
app.start().catch(error => {
  console.error('Failed to start application:', error);
  process.exit(1);
});

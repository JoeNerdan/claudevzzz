/**
 * Development script to run both the Express server and Vite dev server
 * concurrently with proper environment variables
 */
const { exec } = require('child_process');
const chalk = require('chalk');

// Function to log with color and prefix
function logWithPrefix(prefix, data) {
  const lines = data.toString().trim().split('\n');
  lines.forEach(line => {
    if (line.trim()) {
      console.log(`${prefix} ${line}`);
    }
  });
}

// Start the Express server
console.log(chalk.blue('Starting Express server...'));
const expressServer = exec('NODE_ENV=development nodemon server.js');

expressServer.stdout.on('data', (data) => {
  logWithPrefix(chalk.blue('[SERVER]'), data);
});

expressServer.stderr.on('data', (data) => {
  logWithPrefix(chalk.red('[SERVER ERROR]'), data);
});

// Wait a bit for the Express server to start
setTimeout(() => {
  // Start the Vite dev server
  console.log(chalk.green('Starting Vite dev server...'));
  const viteServer = exec('NODE_ENV=development npx vite --port 5173 --host 0.0.0.0');

  viteServer.stdout.on('data', (data) => {
    logWithPrefix(chalk.green('[VITE]'), data);
  });

  viteServer.stderr.on('data', (data) => {
    logWithPrefix(chalk.red('[VITE ERROR]'), data);
  });

  // Handle process termination
  const cleanup = () => {
    console.log(chalk.yellow('Shutting down servers...'));
    viteServer.kill();
    expressServer.kill();
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

}, 1000);
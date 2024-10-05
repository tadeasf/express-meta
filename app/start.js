require('dotenv').config();
const pm2 = require('pm2');

pm2.connect((err) => {
  if (err) {
    console.error('PM2 connection error:', err);
    process.exit(2);
  }

  pm2.start('./pm2.ecosystem.js', (err) => {
    if (err) {
      console.error('PM2 start error:', err);
      process.exit(2);
    }

    console.log('PM2 started successfully');
    pm2.disconnect();
  });
});

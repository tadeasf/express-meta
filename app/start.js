require('dotenv').config();
const pm2 = require('pm2');

pm2.connect((err) => {
  if (err) {
    console.error(err);
    process.exit(2);
  }

  pm2.start('./pm2.ecosystem.js', (err) => {
    if (err) {
      console.error(err);
      process.exit(2);
    }

    pm2.disconnect();
  });
});
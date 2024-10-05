import { Redis } from "ioredis";

const redisUrl = process.env.REDIS_URL || "redis://redis:6380";
const redisOptions = {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy(times: number) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  reconnectOnError: function (err: any) {
    console.log('Reconnecting on error:', err);
    return true;
  }
};

const redisClient = new Redis(redisUrl, redisOptions);

redisClient.on('error', (err) => {
  console.error('Redis error:', err);
});

export const redisCommand = new Redis(redisUrl, redisOptions);

export const redisSubscribe = new Redis(redisUrl, redisOptions);

export const DatabaseStore = {
  MESSAGE_DATABASE: "messages",
};

redisSubscribe.subscribe("DB_SWITCH_CHANNEL", (err, count) => {
  if (err) {
    console.error("Failed to subscribe: %s", err.message);
  } else {
    console.log(
      `Subscribed successfully! This client is currently subscribed to ${count} channels.`
    );
  }
});

redisSubscribe.on("message", (channel, message) => {
  console.log(`Received the following message from ${channel}: ${message}`);
  DatabaseStore.MESSAGE_DATABASE = message;
});

redisCommand.on('error', (err) => {
  console.error('Redis command error:', err);
});

redisSubscribe.on('error', (err) => {
  console.error('Redis subscribe error:', err);
});

redisSubscribe.on('connect', () => {
  console.log('Redis subscribe client connected');
});

redisCommand.on('connect', () => {
  console.log('Redis command client connected');
});

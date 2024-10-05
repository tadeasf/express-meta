import { Redis } from "ioredis";

export const redisCommand = new Redis({
  port: 6379,
  host: "127.0.0.1",
});

export const redisSubscribe = new Redis({
  port: 6379,
  host: "127.0.0.1",
});

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

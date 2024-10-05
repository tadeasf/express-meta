import { redisCommand } from "./redis";
import { client } from "./mongo";
import { DatabaseStore } from "./redis";

export async function getCachedData(key: string) {
  try {
    const cachedData = await redisCommand.get(key);
    if (cachedData) {
      console.log(`Cache hit for key: ${key}`);
      return JSON.parse(cachedData);
    } else {
      console.log(`Cache miss for key: ${key}`);
      return null;
    }
  } catch (error) {
    console.error("Redis error, falling back to database:", error);
    return null;
  }
}

export async function setCachedData(key: string, data: any, expiryInSeconds: number = 3600) {
  try {
    await redisCommand.set(key, JSON.stringify(data), "EX", expiryInSeconds);
    console.log(`Cache set for key: ${key}`);
  } catch (error) {
    console.error("Failed to save data to Redis:", error);
  }
}

export async function updateCollectionsCache() {
  try {
    const db = client.db(DatabaseStore.MESSAGE_DATABASE);
    const collections = await db.listCollections().toArray();

    let collectionsData = [];
    for (const collection of collections) {
      if (collection.name === "system.profile") {
        continue;
      }
      const count = await db.collection(collection.name).countDocuments();
      collectionsData.push({
        name: collection.name,
        messageCount: count,
      });
    }

    const sortedByCount = [...collectionsData].sort((a, b) => b.messageCount - a.messageCount);
    const sortedAlphabetically = [...collectionsData].sort((a, b) => a.name.localeCompare(b.name));

    await setCachedData("collections", sortedByCount, 3600);
    await setCachedData("collectionsAlphabetical", sortedAlphabetically, 3600);

    console.log("Collections cache updated");
  } catch (error) {
    console.error("Failed to update collections cache:", error);
  }
}

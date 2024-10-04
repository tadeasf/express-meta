import { redisCommand } from "./redis";

export async function getCachedData(key: string) {
  try {
    const cachedData = await redisCommand.get(key);
    return cachedData ? JSON.parse(cachedData) : null;
  } catch (error) {
    console.error("Redis error, falling back to database:", error);
    return null;
  }
}

export async function setCachedData(key: string, data: any, expiryInSeconds: number = 3600) {
  try {
    await redisCommand.set(key, JSON.stringify(data), "EX", expiryInSeconds);
  } catch (error) {
    console.error("Failed to save data to Redis:", error);
  }
}

export async function getCollectionTimestamp(collectionName: string): Promise<string> {
  const timestamp = await redisCommand.get(`collection-timestamp:${collectionName}`);
  return timestamp || Date.now().toString();
}

export async function setCollectionTimestamp(collectionName: string): Promise<void> {
  await redisCommand.set(`collection-timestamp:${collectionName}`, Date.now().toString());
}

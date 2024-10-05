import { redisCommand } from "./redis";

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

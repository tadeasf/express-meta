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

export async function setCachedData(key: string, data: any, expiryInSeconds: number = 36000) {
  try {
    await redisCommand.set(key, JSON.stringify(data), "EX", expiryInSeconds);
  } catch (error) {
    console.error("Failed to save data to Redis:", error);
  }
}
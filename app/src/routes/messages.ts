import { Elysia } from "elysia";
import { client } from "../utils/mongo";
import { DatabaseStore } from "../utils/redis";
import { getCachedData, setCachedData, updateCollectionsCache } from "../utils/cache";

export const messagesRoutes = new Elysia()
  .get("/messages/:collectionName", async ({ params, query }) => {
    const collectionName = decodeURIComponent(params.collectionName);
    const fromDate = query.fromDate
      ? new Date(`${query.fromDate}T00:00:00Z`).getTime()
      : null;
    const toDate = query.toDate
      ? new Date(`${query.toDate}T23:59:59Z`).getTime()
      : null;
    const cacheKey = `messages-${collectionName}-${fromDate}-${toDate}`;

    try {
      const cachedData = await getCachedData(cacheKey);
      if (cachedData) {
        console.log(`Returning cached data for ${cacheKey}`);
        return cachedData;
      }

      console.log(`Cache miss for ${cacheKey}. Fetching from DB.`);
      const db = client.db(DatabaseStore.MESSAGE_DATABASE);
      const collection = db.collection(collectionName);

      const pipeline = [
        ...(fromDate !== null || toDate !== null
          ? [
              {
                $match: {
                  ...(fromDate !== null && { timestamp_ms: { $gte: fromDate } }),
                  ...(toDate !== null && { timestamp_ms: { $lte: toDate } }),
                },
              },
            ]
          : []),
        { $sort: { timestamp_ms: 1 } },
        {
          $project: {
            _id: 0,
            timestamp: 1,
            timestamp_ms: 1,
            sender_name: 1,
            content: 1,
            photos: 1,
            is_geoblocked_for_viewer: 1,
          },
        },
      ];

      const messages = await collection.aggregate(pipeline).toArray();

      await setCachedData(cacheKey, messages, 36000); // Cache for 10 hours
      console.log(`Cached data set for ${cacheKey}`);

      // Update collections cache after fetching messages
      await updateCollectionsCache();

      return messages;
    } catch (error) {
      console.error("Failed to fetch messages:", error);
      throw new Error("Internal Server Error");
    }
  });

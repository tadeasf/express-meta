import { Elysia } from "elysia";
import { staticPlugin } from "@elysiajs/static";
import { client } from "../utils/mongo";
import { DatabaseStore } from "../utils/redis";
import { getCachedData, setCachedData } from "../utils/cache";
import path from "path";

export const photosRoutes = new Elysia()
  .use(staticPlugin({
    assets: path.join(__dirname, "..", "..", "photos"),
    prefix: "/photos"
  }))
  .get("/photos/:collectionName", async ({ params }) => {
    const collectionName = decodeURIComponent(params.collectionName);
    const cacheKey = `photos-${collectionName}`;

    try {
      let cachedData = await getCachedData(cacheKey);
      
      if (cachedData) {
        return cachedData;
      }

      const db = client.db(DatabaseStore.MESSAGE_DATABASE);
      const collection = db.collection(collectionName);

      const pipeline = [
        {
          $match: {
            sender_name: { $ne: "Tadeáš Fořt" },
            photos: { $exists: true, $not: { $size: 0 } },
          },
        },
        {
          $project: {
            _id: 0,
            sender_name: 1,
            timestamp_ms: 1,
            photos: 1,
            timestamp: 1,
          },
        },
      ];

      const results = await collection.aggregate(pipeline).toArray();

      await setCachedData(cacheKey, results, 36000); // 10 hours expiry

      return results;
    } catch (error) {
      console.error(error);
      throw new Error("Internal Server Error");
    }
  })
  .get("/messages/:collectionName/photo", async ({ params, request }) => {
    const collectionName = decodeURIComponent(params.collectionName);
    const sanitizedCollectionName = sanitizeName(collectionName);

    const db = client.db(DatabaseStore.MESSAGE_DATABASE);
    const collection = db.collection(sanitizedCollectionName);
    const result = await collection.findOne({ photo: true });

    if (!result) {
      return { isPhotoAvailable: false, photoUrl: null };
    }

    const photoUrl = `https://${request.headers.get('host')}/photos/${sanitizedCollectionName}.jpg`;
    return { isPhotoAvailable: true, photoUrl: photoUrl };
  });

function sanitizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "")
    .replace(/[^a-zA-Z0-9]/g, "");
}
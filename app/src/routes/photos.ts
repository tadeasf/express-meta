import { Elysia, t } from "elysia";
import { staticPlugin } from "@elysiajs/static";
import { client } from "../utils/mongo";
import { DatabaseStore } from "../utils/redis";
import { getCachedData, setCachedData} from "../utils/cache";
import path from "path";
import fs from "fs/promises";

const PHOTOS_DIR = path.join(__dirname, "..", "..", "photos");
const INBOX_DIR = path.join(__dirname, "..", "..", "inbox");

export const photosRoutes = new Elysia()
  .use(staticPlugin({
    assets: PHOTOS_DIR,
    prefix: "/photos"
  }))
  .use(staticPlugin({
    assets: INBOX_DIR,
    prefix: "/inbox"
  }))
  .get("/photos/:collectionName", async ({ params, request }) => {
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

      const resultsWithFullUri = results.map(result => ({
        ...result,
        photos: result.photos.map((photo: { uri: any; }) => ({
          ...photo,
          fullUri: `${request.headers.get('host')}/inbox/${photo.uri}`
        }))
      }));

      await setCachedData(cacheKey, resultsWithFullUri, 36000); // 10 hours expiry

      return resultsWithFullUri;
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
  })
  .get("/serve/photo/:collectionName", async ({ params, set }) => {
    const sanitizedCollectionName = sanitizeName(decodeURIComponent(params.collectionName));

    const photoPath = path.join(PHOTOS_DIR, `${sanitizedCollectionName}.jpg`);
    const inboxPhotoPath = path.join(INBOX_DIR, sanitizedCollectionName, 'photos');

    try {
      await fs.access(photoPath);
      set.headers['Content-Type'] = 'image/jpeg';
      return Bun.file(photoPath);
    } catch {
      try {
        const files = await fs.readdir(inboxPhotoPath);
        if (files.length > 0) {
          const firstPhotoPath = path.join(inboxPhotoPath, files[0]);
          set.headers['Content-Type'] = 'image/jpeg';
          return Bun.file(firstPhotoPath);
        }
      } catch {
      }
    }

    set.status = 404;
    return "Photo not found";
  })
  .post("/upload/photo/:collectionName", async ({ params, body }) => {
    const sanitizedCollectionName = sanitizeName(decodeURIComponent(params.collectionName));
    const photoDir = path.join(PHOTOS_DIR, sanitizedCollectionName);

    try {
      await fs.mkdir(photoDir, { recursive: true });
      const photoPath = path.join(photoDir, `${sanitizedCollectionName}.jpg`);

      // Ensure that body.photo is a string (base64 encoded image)
      if (typeof body.photo !== 'string') {
        throw new Error('Invalid photo data');
      }

      // Remove potential data URL prefix
      const base64Data = body.photo.replace(/^data:image\/\w+;base64,/, '');

      // Convert base64 to buffer
      const photoBuffer = Buffer.from(base64Data, 'base64');

      await fs.writeFile(photoPath, photoBuffer);

      const db = client.db(DatabaseStore.MESSAGE_DATABASE);
      const collection = db.collection(sanitizedCollectionName);
      await collection.updateOne({}, { $set: { photo: true } }, { upsert: true });

      return { message: "Photo uploaded successfully" };
    } catch (error) {
      console.error("Error uploading photo:", error);
      throw new Error("Failed to upload photo");
    }
  }, {
    body: t.Object({
      photo: t.String()
    })
  });

function sanitizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "")
    .replace(/[^a-zA-Z0-9]/g, "");
}

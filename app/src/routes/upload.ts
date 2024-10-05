import { Elysia, t } from 'elysia';
import { client } from '../utils/mongo';
import { DatabaseStore } from '../utils/redis';
import { combine_and_convert_json_files } from '../utils/metaDecoder/jsonCombiner';
import path from 'path';
import fs from 'fs/promises';

const INBOX_DIR = path.join(__dirname, '..', '..', 'inbox');
const PHOTOS_DIR = path.join(__dirname, '..', '..', 'photos');

export const uploadRoutes = new Elysia()
  .post('/upload', async ({ body }) => {
    const files = body.files;
    const combinedJson = await combine_and_convert_json_files(files.map((file: any) => file.path));
    const { participants, messages } = combinedJson;
    let collectionName = normalizeAndSanitize(participants[0].name);

    const db = client.db(DatabaseStore.MESSAGE_DATABASE);

    let index = 0;
    let originalCollectionName = collectionName;
    let collections;

    do {
      collections = await db.listCollections({ name: collectionName }).toArray();

      if (collections.length > 0) {
        index++;
        collectionName = `${originalCollectionName}_${index}`;
      }
    } while (collections.length > 0);

    const collection = db.collection(collectionName);
    await collection.insertMany(messages);

    const inboxCollectionDir = path.join(INBOX_DIR, collectionName);
    const photosDir = path.join(inboxCollectionDir, 'photos');

    try {
      await fs.mkdir(photosDir, { recursive: true });

      for (const file of files) {
        if (file.filename.match(/\.(jpg|jpeg|png|gif)$/i)) {
          const destPath = path.join(photosDir, file.filename);
          await fs.copyFile(file.path, destPath);
        }
      }
    } catch (error) {
      console.error('Error handling photo uploads:', error);
    }

    return {
      message: `Messages uploaded to collection: ${collectionName}`,
      collectionName: collectionName,
      messageCount: messages.length,
    };
  }, {
    body: t.Object({
      files: t.Array(t.Object({
        path: t.String(),
        filename: t.String()
      }))
    })
  })
  .post('/upload/photo/:collectionName', async ({ params, body }) => {
    const sanitizedCollectionName = normalizeAndSanitize(decodeURIComponent(params.collectionName));
    const photoPath = path.join(PHOTOS_DIR, `${sanitizedCollectionName}.jpg`);

    try {
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
  })
  .get('/serve/photo/:collectionName', async ({ params }) => {
    const sanitizedCollectionName = normalizeAndSanitize(decodeURIComponent(params.collectionName));
    const photoPath = path.join(PHOTOS_DIR, `${sanitizedCollectionName}.jpg`);

    try {
      await fs.access(photoPath);
      return new Response(await fs.readFile(photoPath), {
        headers: { 'Content-Type': 'image/jpeg' }
      });
    } catch (error) {
      console.log(`Photo not found for collection: ${sanitizedCollectionName}`);
      // Instead of returning a 404, return a default image or a transparent 1x1 pixel
      return new Response(Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64'), {
        headers: { 'Content-Type': 'image/gif' }
      });
    }
  });

function normalizeAndSanitize(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '')
    .replace(/[^a-zA-Z0-9]/g, '');
}

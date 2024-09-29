import { Elysia } from "elysia";
import { client } from "../utils/mongo";
import { DatabaseStore } from "../utils/redis";
import path from "path";
import fs from "fs/promises";

export const deleteRoutes = new Elysia()
  .delete("/delete/:collectionName", async ({ params }) => {
    const collectionName = decodeURIComponent(params.collectionName);

    const db = client.db(DatabaseStore.MESSAGE_DATABASE);
    const collection = db.collection(collectionName);
    await collection.drop();

    return {
      message: `Collection "${collectionName}" deleted.`,
      collectionName: collectionName,
    };
  })
  .delete("/delete/photo/:collectionName", async ({ params }) => {
    const sanitizedCollectionName = sanitizeName(decodeURIComponent(params.collectionName));

    const photoDir = path.join(__dirname, "..", "..", "photos");
    const files = await fs.readdir(photoDir);
    const db = client.db(DatabaseStore.MESSAGE_DATABASE);
    const collection = db.collection(sanitizedCollectionName);
    const photoFile = files.find((file) => file.startsWith(sanitizedCollectionName));

    if (photoFile) {
      const photoPath = path.join(photoDir, photoFile);
      await fs.unlink(photoPath);
      await collection.updateOne({}, { $set: { photo: false } }, { upsert: true });
      return { message: "Photo deleted successfully and database updated" };
    } else {
      const doc = await collection.findOne({});
      if (doc && doc.photo === true) {
        await collection.updateOne({}, { $set: { photo: false } }, { upsert: true });
        return { message: "Photo not found, but database updated" };
      }
      return { message: "Photo not found and nothing to update in database" };
    }
  });

function sanitizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "")
    .replace(/[^a-zA-Z0-9]/g, "");
}
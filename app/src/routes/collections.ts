import { Elysia } from "elysia";
import { client } from "../utils/mongo";
import { DatabaseStore } from '../utils/redis';
import { getCachedData, setCachedData } from "../utils/cache";

export const collectionsRoutes = new Elysia()
  .get("/collections", async () => {
    try {
      let cachedData = await getCachedData("collections");
      
      if (cachedData) {
        return cachedData;
      }

      const db = client.db(DatabaseStore.MESSAGE_DATABASE);
      const collections = await db.listCollections().toArray();
      const collectionNames = collections.map((c, index) => ({ name: c.name, index }));

      await setCachedData("collections", collectionNames);

      return collectionNames.length > 0 ? collectionNames : { error: "No data found" };
    } catch (error) {
      console.error(error);
      throw new Error("Internal Server Error");
    }
  })

  .get("/collections/alphabetical", async () => {
    try {
      let cachedData = await getCachedData("collectionsAlphabetical");
      
      if (cachedData) {
        return cachedData;
      }

      const db = client.db(DatabaseStore.MESSAGE_DATABASE);
      const collections = await db.listCollections().toArray();
      const collectionNames = collections.map((c) => c.name).sort();

      await setCachedData("collectionsAlphabetical", collectionNames);

      return collectionNames.length > 0 ? collectionNames : { error: "No data found" };
    } catch (error) {
      console.error(error);
      throw new Error("Internal Server Error");
    }
  });
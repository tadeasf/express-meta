import { Elysia } from "elysia";
import { getCachedData, updateCollectionsCache } from "../utils/cache";

export const collectionsRoutes = new Elysia()
  .get("/collections", async () => {
    try {
      let cachedData = await getCachedData("collections");
      
      if (cachedData) {
        return cachedData;
      }

      await updateCollectionsCache();
      cachedData = await getCachedData("collections");

      return cachedData || { error: "No data found" };
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

      await updateCollectionsCache();
      cachedData = await getCachedData("collectionsAlphabetical");

      return cachedData || { error: "No data found" };
    } catch (error) {
      console.error(error);
      throw new Error("Internal Server Error");
    }
  });
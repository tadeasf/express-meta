import { Elysia } from "elysia";
import { client } from "../utils/mongo";
import { DatabaseStore } from "../utils/redis";
import { setCollectionTimestamp } from "../utils/cache";

export const renameRoutes = new Elysia()
  .post("/rename/:oldName/:newName", async ({ params }) => {
    const { oldName, newName } = params;
    const db = client.db(DatabaseStore.MESSAGE_DATABASE);

    try {
      await db.collection(oldName).rename(newName);
      await setCollectionTimestamp(newName);
      return { message: `Collection renamed from ${oldName} to ${newName}` };
    } catch (error) {
      console.error("Failed to rename collection:", error);
      throw new Error("Failed to rename collection");
    }
  });

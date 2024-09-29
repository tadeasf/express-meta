import { Elysia, t } from "elysia";
import { client } from "../utils/mongo";
import { DatabaseStore } from "../utils/redis";

export const renameRoutes = new Elysia()
  .put("/rename/:currentCollectionName", async ({ params, body, set }) => {
    const currentCollectionName = decodeURIComponent(params.currentCollectionName);
    const newCollectionName = (body as { newCollectionName: string }).newCollectionName.trim();

    if (!newCollectionName || !/^[a-zA-Z0-9_]+$/.test(newCollectionName)) {
      set.status = 400;
      return { message: "Invalid collection name: Does not match naming convention" };
    }

    const db = client.db(DatabaseStore.MESSAGE_DATABASE);
    const currentCollection = db.collection(currentCollectionName);
    await currentCollection.rename(newCollectionName);

    return { message: `Collection renamed to ${newCollectionName}` };
  }, {
    body: t.Object({
      newCollectionName: t.String()
    })
  });
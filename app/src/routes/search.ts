import { Elysia, t } from "elysia";
import { client } from "../utils/mongo";
import { DatabaseStore } from "../utils/redis";
import diacritics from "diacritics";

type PipelineStage = {
  $match?: any;
  $addFields?: any;
  $unionWith?: {
    coll: string;
    pipeline: PipelineStage[];
  };
};

export const searchRoutes = new Elysia()
  .post("/search", async ({ body }) => {
    const query = (body as { query: string }).query;
    const db = client.db(DatabaseStore.MESSAGE_DATABASE);

    const collections = await db.listCollections().toArray();
    const collectionNames = collections
      .map((c) => c.name)
      .filter((name) => !["system.profile", "system.indexes", "unified_collection"].includes(name));

    const initialPipeline: PipelineStage[] = [
      {
        $match: {
          $text: { $search: query },
        },
      },
      {
        $addFields: {
          collectionName: collectionNames[0],
        },
      },
    ];

    const unionWithStages: PipelineStage[] = collectionNames.slice(1).map((collectionName) => ({
      $unionWith: {
        coll: collectionName,
        pipeline: [
          {
            $match: {
              sanitizedContent: {
                $regex: new RegExp(diacritics.remove(query), "i"),
              },
            },
          },
          {
            $addFields: {
              collectionName: collectionName,
            },
          },
        ],
      },
    }));

    const finalPipeline: PipelineStage[] = initialPipeline.concat(unionWithStages);

    const potentialMatches = await db
      .collection(collectionNames[0])
      .aggregate(finalPipeline)
      .toArray();

    const actualMatches = potentialMatches.map(({ sanitizedContent, ...rest }) => rest);

    return actualMatches;
  }, {
    body: t.Object({
      query: t.String()
    })
  });
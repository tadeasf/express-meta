import { Elysia, t } from 'elysia';
import { Context } from 'elysia';
import diacritics from 'diacritics';

type PipelineStage = 
  | { $match: { $text: { $search: string } } | { sanitizedContent: { $regex: RegExp } } }
  | { $addFields: { collectionName: string } }
  | { $unionWith: { coll: string, pipeline: PipelineStage[] } };

export const searchTextRoutes = new Elysia()
  .post('/search_text', async ({ body, db }: Context) => {
    const query = body.query;
    const collections = await db().listCollections().toArray();
    const collectionNames = collections
      .map((c: { name: string }) => c.name)
      .filter((name: string) => !["system.profile", "system.indexes", "unified_collection"].includes(name));

    const initialPipeline: PipelineStage[] = [
      {
        $match: {
          $text: {
            $search: query,
          },
        },
      },
      {
        $addFields: {
          collectionName: collectionNames[0],
        },
      },
    ];

    const unionWithStages: PipelineStage[] = collectionNames.slice(1).map((collectionName: string) => ({
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

    const potentialMatches = await db()
      .collection(collectionNames[0])
      .aggregate(finalPipeline)
      .toArray();

    return potentialMatches.map((doc: any) => {
      const { sanitizedContent, ...rest } = doc;
      return rest;
    });
  }, {
    body: t.Object({
      query: t.String()
    })
  });

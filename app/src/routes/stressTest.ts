import { Elysia } from 'elysia';
import { Context } from 'elysia';
import { generate } from 'random-words';

type PipelineStage = 
  | { $match: { $text: { $search: string } } | { content: { $regex: RegExp } } }
  | { $addFields: { collectionName: string } }
  | { $unionWith: { coll: string, pipeline: PipelineStage[] } };

export const stressTestRoutes = new Elysia()
  .get('/stress-test', async ({ db }: Context) => {
    const startTime = Date.now();
    const randomWord = generate() as string;
    const sanitizedRandomWord = sanitizeName(randomWord);

    const collections = await db().listCollections().toArray();
    const collectionNames = collections.map((c: { name: string }) => c.name);

    const initialPipeline: PipelineStage[] = [
      {
        $match: {
          $text: {
            $search: sanitizedRandomWord,
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
              content: {
                $regex: new RegExp(sanitizedRandomWord, "i"),
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

    const endTime = Date.now();
    const duration = endTime - startTime;

    return {
      message: "Stress test completed successfully",
      searchString: randomWord,
      duration: `${duration} ms`,
      searchMatches: potentialMatches.length,
      randomMatch: potentialMatches[Math.floor(Math.random() * potentialMatches.length)],
      data: potentialMatches,
    };
  });

function sanitizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "")
    .replace(/[^a-zA-Z0-9]/g, "");
}
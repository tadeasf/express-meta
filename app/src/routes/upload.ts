import { Elysia, t } from 'elysia';
import { client } from '../utils/mongo';
import { DatabaseStore } from '../utils/redis';
import { combine_and_convert_json_files } from '../utils/metaDecoder/jsonCombiner';

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

    return {
      message: `Messages uploaded to collection: ${collectionName}`,
      collectionName: collectionName,
      messageCount: messages.length,
    };
  }, {
    body: t.Object({
      files: t.Array(t.Object({
        path: t.String()
      }))
    })
  });

function normalizeAndSanitize(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '');
}
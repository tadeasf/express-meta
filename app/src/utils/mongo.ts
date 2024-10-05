import { MongoClient, MongoClientOptions } from "mongodb";

const uri = process.env.MONGODB_URI;
console.log("URI: ", uri);

const clientOptions: MongoClientOptions = {
  connectTimeoutMS: 30000,
  socketTimeoutMS: 30000,
  maxPoolSize: 350,
  minPoolSize: 5,
  maxConnecting: 32,
  maxIdleTimeMS: 5000,
  waitQueueTimeoutMS: 15000,
  retryReads: true,
  retryWrites: true,
  directConnection: false,
  writeConcern: { w: "majority", wtimeoutMS: 5000 },
  compressors: ["zlib"],
  zlibCompressionLevel: 7,
};

export const client = new MongoClient(uri as string, clientOptions);
/** @format */

require("dotenv").config();
process.env.NODE_ENV = process.env.NODE_ENV || "development";
const express = require("express");
const swaggerUi = require("swagger-ui-express");
const swaggerDocument = require("./swagger-output.json");
const { MongoClient } = require("mongodb");
const cors = require("cors");
const morgan = require("morgan");
let generate, count;
import("random-words").then((randomWords) => {
  ({ generate, count } = randomWords);
});
const Redis = require("ioredis");
const app = express();
const port = process.env.PORT || 5555;
const multer = require("multer");
const fs = require("fs").promises;
const path = require("path");
const os = require("os");
const bodyParser = require("body-parser");
const { combine_and_convert_json_files } = require("./json_combiner");
const { v4: uuidv4 } = require("uuid");
const compression = require("compression");
const diacritics = require("diacritics");
// Redis client for commands
const redisCommand = new Redis({
  port: 6379, // Redis port
  host: "127.0.0.1", // Redis host
});
redisCommand.on("error", (err) => {
  console.error("Redis Command Client Error: ", err);
});

// Redis client for subscription
const redisSubscribe = new Redis({
  port: 6379, // Redis port
  host: "127.0.0.1", // Redis host
});
redisSubscribe.on("error", (err) => {
  console.error("Redis Subscribe Client Error: ", err);
});

// Default database name
let MESSAGE_DATABASE = "messages";

// Subscribe to Redis channel for DB name updates
redisSubscribe.subscribe("DB_SWITCH_CHANNEL", (err, count) => {
  if (err) {
    console.error("Failed to subscribe: %s", err.message);
  } else {
    console.log(
      `Subscribed successfully! This client is currently subscribed to ${count} channels.`
    );
  }
});
redisSubscribe.on("message", (channel, message) => {
  console.log(`Received the following message from ${channel}: ${message}`);
  MESSAGE_DATABASE = message;
});

// Database Connection Management
const uri = process.env.MONGODB_URI;
console.log("URI: ", uri);
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  // replicaSet: "fortReplicaSet",
  // readPreference: "secondaryPreferred",
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
  writeConcern: { w: "majority", wtimeout: 5000 },
  compressors: "zlib",
  zlibCompressionLevel: 7,
});

const redis = new Redis({
  port: 6379,
  host: "127.0.0.1",
});
redis.on("error", (err) => {
  console.log("Redis Error: ", err);
});

// Optionally handle connection events
try {
  redis.on("connect", () => {
    console.log("Connected to Redis");
  });
} catch (error) {
  console.error("Error connecting to Redis:", error);
}

// Remember to gracefully close the Redis connection when your app exits
process.on("exit", () => {
  redis.quit();
});
client.connect();
//ALLOW CORS FOR LOAD BALANCER
app.use(
  cors({
    origin: "*",
  })
);

app.use(morgan("combined"));
app.use(compression());
app.use(bodyParser.json());
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.get("/", (req, res) => {
  res.send("Hi, Blackbox, grab some data! omnomnomnom...");
});

// Function to sanitize collection names
const sanitizeName = (name) => {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "")
    .replace(/[^a-zA-Z0-9]/g, "");
};
// Middleware for file uploads with structured directory
const storage = multer.diskStorage({
  destination: async function (req, file, cb) {
    // Generate a UUID for the subdirectory
    const uniqueSubdir = uuidv4();

    const dir = `uploads/${uniqueSubdir}/${req.get("host")}`;
    await fs.mkdir(dir, { recursive: true });
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});

// Middleware for photo uploads with structured naming
const photoStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, "photos");
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const collectionName = decodeURIComponent(req.params.collectionName);
    const sanitizedCollectionName = sanitizeName(collectionName);
    const extension = path.extname(file.originalname); // Get the extension of the original file
    const filename = `${sanitizedCollectionName}${extension}`; // Construct the filename using only the sanitized collection name and extension
    cb(null, filename);
  },
});

const upload_photo = multer({ storage: photoStorage });

const upload = multer({ storage: storage });

// Middleware to track start time of request
app.use((req, res, next) => {
  req.startTime = Date.now();
  next();
});

// Utility function to format time difference
function formatTimeDifference(startTime) {
  const endTime = Date.now();
  const diff = new Date(endTime - startTime);
  const hh = String(diff.getUTCHours()).padStart(2, "0");
  const mm = String(diff.getUTCMinutes()).padStart(2, "0");
  const ss = String(diff.getUTCSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function logEndpointInfo(req, res, endpoint) {
  const timeTaken = formatTimeDifference(req.startTime);
  const requesterIP = req.ip; // Get the IP address of the requester
  console.log(
    `Endpoint: ${endpoint}, Request Contents: ${JSON.stringify(
      req.body
    )}, Requester IP: ${requesterIP}, Time Taken: ${timeTaken}`
  );
}

// Error Handling
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  logError(err);
  process.exit(1); // Exit the process with failure
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  logError(reason);
  setTimeout(() => {
    process.exit(1);
  }, 1000); // Delay for 1 second
});

async function logError(error) {
  const errorLog = {
    timestamp: new Date().toISOString(),
    message: error.message,
    stack: error.stack,
  };

  const logsDir = path.join(__dirname, "logs");
  const logFilePath = path.join(logsDir, "error-log.json");

  try {
    await fs.mkdir(logsDir);
  } catch (err) {
    if (err.code !== "EEXIST") {
      throw err;
    }
  }

  try {
    await fs.appendFile(logFilePath, JSON.stringify(errorLog) + os.EOL);
  } catch (err) {
    console.error("Error while writing error log:", err);
  }

  console.error("Error logged:", errorLog);

  return errorLog;
}

async function sanitizeCollections() {
  try {
    await client.connect();
    const db = client.db(MESSAGE_DATABASE);

    // Fetch all collection names
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map((c) => c.name);

    const promises = collectionNames.map(async (collectionName) => {
      // Get the total count of documents that meet the criteria
      const totalCount = await db.collection(collectionName).countDocuments({
        content: { $exists: true, $ne: null },
        sanitizedContent: { $exists: false },
      });

      // Process all documents that meet the criteria using bulk updates
      const bulkOps = [];
      const batchSize = 100; // Adjust the batch size as needed

      for (let skip = 0; skip < totalCount; skip += batchSize) {
        const documents = await db
          .collection(collectionName)
          .find({
            content: { $exists: true, $ne: null },
            sanitizedContent: { $exists: false },
          })
          .skip(skip)
          .limit(batchSize)
          .toArray();

        for (const doc of documents) {
          const sanitizedContent = diacritics.remove(doc.content);
          bulkOps.push({
            updateOne: {
              filter: { _id: doc._id },
              update: { $set: { sanitizedContent } },
            },
          });
        }
      }

      if (bulkOps.length > 0) {
        await db.collection(collectionName).bulkWrite(bulkOps);
      }
    });

    // Execute all promises in parallel
    await Promise.all(promises);

    console.log("Collections sanitized successfully.");
  } catch (error) {
    console.error("Error during sanitization:", error);
  }
}

// Start the sanitization process when the server starts
sanitizeCollections();
async function updateCollectionsCache() {
  const db = client.db(MESSAGE_DATABASE);
  const collections = await db.listCollections().toArray();

  let collectionsData = [];
  for (const collection of collections) {
    // Skip system.profile and other collections you want to exclude
    if (collection.name === "system.profile") {
      continue;
    }

    const count = await db.collection(collection.name).countDocuments();
    collectionsData.push({
      name: collection.name,
      messageCount: count,
    });
  }

  // Sort and store in Redis
  const sortedByCount = [...collectionsData].sort(
    (a, b) => b.messageCount - a.messageCount
  );
  const sortedAlphabetically = [...collectionsData].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  // Use JSON.stringify to store array data as a string
  await redis.set("collections", JSON.stringify(sortedByCount));
  await redis.set(
    "collectionsAlphabetical",
    JSON.stringify(sortedAlphabetically)
  );
}

// Initial cache population
updateCollectionsCache();

// Set an interval to update the cache every minute
setInterval(updateCollectionsCache, 5000);

// Endpoint to get collections
app.get("/collections", async (req, res) => {
  logEndpointInfo(req, res, "GET /collections");
  try {
    let cachedData = null;
    try {
      cachedData = await redis.get("collections");
    } catch (redisError) {
      console.error(
        "Redis error, falling back to database:",
        redisError.message
      );
    }

    if (cachedData) {
      return res.status(200).json(JSON.parse(cachedData));
    }

    // Assuming `db` is your MongoDB database instance
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map((c) => c.name);

    try {
      await redis.set(
        "collections",
        JSON.stringify(collectionNames),
        "EX",
        36000
      );
    } catch (redisError) {
      console.error("Failed to save data to Redis:", redisError.message);
    }

    if (collectionNames.length > 0) {
      res.status(200).json(collectionNames);
    } else {
      res.status(404).send("No data found");
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/collections/alphabetical", async (req, res) => {
  logEndpointInfo(req, res, "GET /collections/alphabetical");
  try {
    let cachedData = null;
    try {
      cachedData = await redis.get("collectionsAlphabetical");
    } catch (redisError) {
      console.error(
        "Redis error, falling back to database:",
        redisError.message
      );
    }

    if (cachedData) {
      return res.status(200).json(JSON.parse(cachedData));
    }

    // Assuming `db` is your MongoDB database instance and collections have names to sort alphabetically
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map((c) => c.name).sort();

    try {
      await redis.set(
        "collectionsAlphabetical",
        JSON.stringify(collectionNames),
        "EX",
        36000
      );
    } catch (redisError) {
      console.error("Failed to save data to Redis:", redisError.message);
    }

    if (collectionNames.length > 0) {
      res.status(200).json(collectionNames);
    } else {
      res.status(404).send("No data found");
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

// Endpoint to get messages by collection name

app.get("/messages/:collectionName", async (req, res) => {
  const collectionName = decodeURIComponent(req.params.collectionName);
  const fromDate = req.query.fromDate
    ? new Date(`${req.query.fromDate}T00:00:00Z`).getTime()
    : null;
  const toDate = req.query.toDate
    ? new Date(`${req.query.toDate}T23:59:59Z`).getTime()
    : null;
  const cacheKey = `messages-${collectionName}-${fromDate}-${toDate}`;

  try {
    // Initialize variable to hold cached data or null
    let cachedData = null;

    try {
      // Try to get data from Redis cache
      cachedData = await redis.get(cacheKey);
    } catch (redisError) {
      console.error(
        "Redis error, falling back to database:",
        redisError.message
      );
      // Don't return or throw; simply log the error and move on to fetching from the database
    }

    if (cachedData) {
      return res.status(200).json(JSON.parse(cachedData));
    }

    console.log(`fromDate timestamp: ${fromDate}, toDate timestamp: ${toDate}`);
    const db = client.db(MESSAGE_DATABASE);
    const collection = db.collection(collectionName);

    const pipeline = [
      ...(fromDate !== null || toDate !== null
        ? [
            {
              $match: {
                ...(fromDate !== null && { timestamp_ms: { $gte: fromDate } }),
                ...(toDate !== null && { timestamp_ms: { $lte: toDate } }),
              },
            },
          ]
        : []),
      { $sort: { timestamp_ms: 1 } },
      {
        $project: {
          _id: 0,
          timestamp: 1,
          timestamp_ms: 1,
          sender_name: 1,
          content: 1,
          photos: 1,
          is_geoblocked_for_viewer: 1,
        },
      },
    ];

    const messages = await collection.aggregate(pipeline).toArray();

    // Try to save the fetched data in Redis with a catch for errors
    try {
      await redis.set(cacheKey, JSON.stringify(messages), "EX", 36000); // Setting an expiry of 10 hours
    } catch (redisError) {
      console.error("Failed to save data to Redis:", redisError.message);
      // Again, only log the error; don't throw, to ensure we still return MongoDB data
    }

    logEndpointInfo(req, res, `GET /messages/${req.params.collectionName}`);
    res.status(200).json(messages);
  } catch (error) {
    console.error("Failed to fetch messages:", error);
    res.status(500).send("Internal Server Error");
  }
});

// Endpoint to upload messages
const normalizeAndSanitize = (str) => {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "");
};

app.post("/upload", upload.array("files"), async (req, res) => {
  console.log("Request body:", req.body);
  console.log("Files:", req.files);
  const combinedJson = await combine_and_convert_json_files(
    req.files.map((file) => file.path)
  );
  const { participants, messages } = combinedJson;
  let collectionName = normalizeAndSanitize(participants[0].name);

  const db = client.db(MESSAGE_DATABASE);

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

  logEndpointInfo(req, res, "POST /upload");
  res.status(200).json({
    message: `Messages uploaded to collection: ${collectionName}`,
    collectionName: collectionName,
    messageCount: messages.length,
  });
});

// Endpoint to delete a collection
app.delete("/delete/:collectionName", async (req, res) => {
  const collectionName = decodeURIComponent(req.params.collectionName);

  const db = client.db(MESSAGE_DATABASE);
  const collection = db.collection(collectionName);
  await collection.drop();

  logEndpointInfo(req, res, `DELETE /delete/${req.params.collectionName}`);
  res.status(200).json({
    message: `Collection "${collectionName}" deleted.`,
    collectionName: collectionName,
  });
  // After dropping the collection
  const cachedCollections = cache.get("collections") || [];
  const updatedCollections = cachedCollections.filter(
    (col) => col.name !== collectionName
  );
  cache.set("collections", updatedCollections);
});

// Endpoint to check if a photo is available for a collection
app.get("/messages/:collectionName/photo", async (req, res) => {
  const collectionName = decodeURIComponent(req.params.collectionName);
  const sanitizedCollectionName = sanitizeName(collectionName); // Sanitize the collection name

  const db = client.db(MESSAGE_DATABASE);
  const collection = db.collection(sanitizedCollectionName); // Use sanitized name for MongoDB collection
  const result = await collection.findOne({ photo: true });

  if (!result) {
    // logEndpointInfo(req, res, `GET /messages/${req.params.collectionName}/photo`);
    res.status(200).json({ isPhotoAvailable: false, photoUrl: null });
    console.log("Photo not found");
    return;
  }

  // Use sanitized name for photo URL
  const photoUrl = `https://${req.get(
    "host"
  )}/serve/photo/${sanitizedCollectionName}`;

  // logEndpointInfo(req, res, `GET /messages/${req.params.collectionName}/photo`);
  res.status(200).json({ isPhotoAvailable: true, photoUrl: photoUrl });
  console.log("Photo found");
  console.log(photoUrl);
});

// Endpoint to upload a photo for a collection
app.post(
  "/upload/photo/:collectionName",
  upload_photo.single("photo"),
  async (req, res) => {
    if (!req.file) {
      // logEndpointInfo(req, res, `POST /upload/photo/${req.params.collectionName}`);
      res.status(400).json({ message: "No photo provided" });
      return;
    }

    const sanitizedCollectionName = sanitizeName(
      decodeURIComponent(req.params.collectionName)
    );
    const db = client.db(MESSAGE_DATABASE);
    const collection = db.collection(sanitizedCollectionName);
    await collection.updateOne({}, { $set: { photo: true } }, { upsert: true });

    // logEndpointInfo(req, res, `POST /upload/photo/${req.params.collectionName}`);
    res.status(200).json({ message: "Photo uploaded successfully" });
  }
);

// Endpoint to serve a photo for a collection
app.get("/serve/photo/:collectionName", async (req, res) => {
  const sanitizedCollectionName = sanitizeName(
    decodeURIComponent(req.params.collectionName)
  );

  const photoDir = path.join(__dirname, "photos");
  const files = await fs.readdir(photoDir);

  const photoFile = files.find((file) =>
    file.startsWith(sanitizedCollectionName)
  );

  if (!photoFile) {
    // logEndpointInfo(req, res, `GET /serve/photo/${req.params.collectionName}`);
    res.status(404).json({ message: "Photo not found" });
    console.log("Photo not found");
    return;
  }

  const photoPath = path.join(photoDir, photoFile);
  // logEndpointInfo(req, res, `GET /serve/photo/${req.params.collectionName}`);
  res.sendFile(photoPath);
  console.log("Photo found");
});

// Endpoint to delete a photo for a collection
app.delete("/delete/photo/:collectionName", async (req, res) => {
  const sanitizedCollectionName = sanitizeName(
    decodeURIComponent(req.params.collectionName)
  );

  const photoDir = path.join(__dirname, "photos");
  const files = await fs.readdir(photoDir);
  const db = client.db(MESSAGE_DATABASE);
  const collection = db.collection(sanitizedCollectionName);
  const photoFile = files.find((file) =>
    file.startsWith(sanitizedCollectionName)
  );

  if (photoFile) {
    const photoPath = path.join(photoDir, photoFile);
    await fs.unlink(photoPath);
    await collection.updateOne(
      {},
      { $set: { photo: false } },
      { upsert: true }
    );
    res
      .status(200)
      .json({ message: "Photo deleted successfully and database updated" });
    return;
  } else {
    const doc = await collection.findOne({});
    if (doc && doc.photo === true) {
      await collection.updateOne(
        {},
        { $set: { photo: false } },
        { upsert: true }
      );
      res
        .status(200)
        .json({ message: "Photo not found, but database updated" });
      return;
    }
    res
      .status(404)
      .json({ message: "Photo not found and nothing to update in database" });
  }
});

// Serving static photos
app.use("/photos", express.static(path.join(__dirname, "photos")));
app.use("/inbox", express.static(path.join(__dirname, "inbox")));
// Endpoint to rename a collection
app.put("/rename/:currentCollectionName", async (req, res) => {
  const currentCollectionName = decodeURIComponent(
    req.params.currentCollectionName
  );
  const newCollectionName = req.body.newCollectionName.trim();

  if (!newCollectionName || !/^[a-zA-Z0-9_]+$/.test(newCollectionName)) {
    logEndpointInfo(
      req,
      res,
      `PUT /rename/${req.params.currentCollectionName}`
    );
    res.status(400).json({
      message: "Invalid collection name: Does not match naming convention",
    });
    return;
  }

  const db = client.db(MESSAGE_DATABASE);
  const currentCollection = db.collection(currentCollectionName);
  await currentCollection.rename(newCollectionName);

  logEndpointInfo(req, res, `PUT /rename/${req.params.currentCollectionName}`);
  res
    .status(200)
    .json({ message: `Collection renamed to ${newCollectionName}` });
  // After renaming the collection
  const count = await db.collection(newCollectionName).countDocuments();
  const cachedCollections = cache.get("collections") || [];
  const updatedCollections = cachedCollections.filter(
    (col) => col.name !== currentCollectionName
  );
  updatedCollections.push({
    name: newCollectionName,
    messageCount: count,
  });
  cache.set("collections", updatedCollections);
});

app.post("/search", express.json(), async (req, res) => {
  logEndpointInfo(req, res, `GET /messages/${req.params.collectionName}`);

  const query = req.body.query;
  const db = client.db(MESSAGE_DATABASE);

  try {
    // Fetch all collection names
    const collections = await db.listCollections().toArray();
    // remove system.profile, system.index and unified_collections from the listCollection
    const collectionNames = collections
      .map((c) => c.name)
      .filter(
        (name) =>
          !["system.profile", "system.indexes", "unified_collection"].includes(
            name
          )
      );

    // Construct the initial pipeline with $match and $addFields for the first collection
    const initialPipeline = [
      {
        $match: {
          sanitizedContent: {
            $regex: new RegExp(diacritics.remove(query), "i"),
          },
        },
      },
      {
        $addFields: {
          collectionName: collectionNames[0], // <-- Add the collection name here
        },
      },
    ];

    // Dynamically add $unionWith stages for the remaining collections
    const unionWithStages = collectionNames.slice(1).map((collectionName) => ({
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
              collectionName: collectionName, // <-- Add the collection name here
            },
          },
        ],
      },
    }));

    const finalPipeline = initialPipeline.concat(unionWithStages);

    const potentialMatches = await db
      .collection(collectionNames[0])
      .aggregate(finalPipeline)
      .toArray();

    // Filter out sanitizedContent and convert to lowercase
    const actualMatches = potentialMatches.map((doc) => {
      const { sanitizedContent, ...rest } = doc;
      return { ...rest };
    });

    res.json(actualMatches);
  } catch (error) {
    console.error("Error during aggregation:", error);
    res
      .status(500)
      .json({ error: "An error occurred while performing the search." });
  }
});

app.post("/search_text", express.json(), async (req, res) => {
  logEndpointInfo(req, res, `GET /messages/${req.params.collectionName}`);

  const query = req.body.query;
  const db = client.db(MESSAGE_DATABASE);

  try {
    // Fetch all collection names
    const collections = await db.listCollections().toArray();
    // remove system.profile, system.index and unified_collections from the listCollection
    const collectionNames = collections
      .map((c) => c.name)
      .filter(
        (name) =>
          !["system.profile", "system.indexes", "unified_collection"].includes(
            name
          )
      );

    // Construct the initial pipeline with $match and $addFields for the first collection
    const initialPipeline = [
      {
        $match: {
          // do text search instead of regex
          $text: {
            $search: query,
          },
        },
      },
      {
        $addFields: {
          collectionName: collectionNames[0], // <-- Add the collection name here
        },
      },
    ];

    // Dynamically add $unionWith stages for the remaining collections
    const unionWithStages = collectionNames.slice(1).map((collectionName) => ({
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
              collectionName: collectionName, // <-- Add the collection name here
            },
          },
        ],
      },
    }));

    const finalPipeline = initialPipeline.concat(unionWithStages);

    const potentialMatches = await db
      .collection(collectionNames[0])
      .aggregate(finalPipeline)
      .toArray();

    // Filter out sanitizedContent and convert to lowercase
    const actualMatches = potentialMatches.map((doc) => {
      const { sanitizedContent, ...rest } = doc;
      return { ...rest };
    });

    res.json(actualMatches);
  } catch (error) {
    console.error("Error during aggregation:", error);
    res
      .status(500)
      .json({ error: "An error occurred while performing the search." });
  }
});

app.get("/photos/:collectionName", async (req, res) => {
  const collectionName = decodeURIComponent(req.params.collectionName);
  const cacheKey = `photos-${collectionName}`; // Generate a unique cache key

  try {
    const cachedData = await redis.get(cacheKey); // Try to get data from Redis cache

    if (cachedData) {
      console.log(`Cache hit for ${cacheKey}.`);
      return res.status(200).json(JSON.parse(cachedData));
    }

    console.log(`Cache miss for ${cacheKey}. Fetching from DB.`);
    const db = client.db(MESSAGE_DATABASE);
    const collection = db.collection(collectionName);

    const pipeline = [
      {
        $match: {
          sender_name: { $ne: "Tadeáš Fořt" },
          photos: { $exists: true, $not: { $size: 0 } },
        },
      },
      {
        $project: {
          _id: 0,
          sender_name: 1,
          timestamp_ms: 1,
          photos: 1,
          timestamp: 1,
        },
      },
    ];

    const results = await collection.aggregate(pipeline).toArray();

    // Save the fetched data in Redis with an optional expiry time
    await redis.set(cacheKey, JSON.stringify(results), "EX", 36000); // 10 hours expiry

    res.status(200).json(results);
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

// Custom error handling middleware
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    // A Multer error occurred when uploading.
    console.error("MulterError encountered:", err);
    return res
      .status(400)
      .json({ error: "File upload error", details: err.message });
  } else if (err) {
    // An unknown error occurred.
    console.error("An unknown error occurred:", err);
    return res
      .status(500)
      .json({ error: "An error occurred", details: err.message });
  }

  // Pass to next middleware if no errors
  next();
});

// ----------------- DB SWITCHING----------------- //
// Add an endpoint to switch the database based on the URL parameter
app.get("/switch_db/:dbName", async (req, res) => {
  const { dbName } = req.params;
  await redis.publish("DB_SWITCH_CHANNEL", dbName);
  res.send(`Database switch initiated: ${dbName}`);
});

// Add another endpoint to toggle the MESSAGE_DATABASE between two values
app.get("/switch_db/", async (req, res) => {
  // Determine the new database value
  const newDb = MESSAGE_DATABASE === "messages" ? "message_backup" : "messages";

  try {
    // Publish the new database name to a Redis channel
    await redis.publish("DB_SWITCH_CHANNEL", newDb);

    // Optionally, flush Redis database if needed
    await redis.flushdb();

    res.send(`Database switch initiated: ${newDb}`);
  } catch (error) {
    console.error("Error switching database:", error);
    res.status(500).send("Internal Server Error");
  }
});

// Example usage of the MESSAGE_DATABASE variable
app.get("/current_db", (req, res) => {
  res.send(`${MESSAGE_DATABASE}`);
});

app.get("/flush_redis", async (req, res) => {
  try {
    await redis.flushdb();
    res.send("Redis cache flushed successfully.");
  } catch (error) {
    console.error("Error flushing Redis cache:", error);
    res.status(500).send("Internal Server Error");
  }
});

// ----------------- STRESS TESTING ----------------- //
app.get("/load-cpu", (req, res) => {
  let total = 0;
  // start timer to measure the time taken
  const startTime = Date.now();
  for (let i = 0; i < 70000000; i++) {
    total += Math.sqrt(i) * Math.random();
    total -= Math.pow(i, 2) * Math.random();
    total *= Math.sin(i) * Math.random();
  }
  const endTime = Date.now();
  const duration = endTime - startTime;
  // return duration in seconds + result to the clinet
  res.json({
    duration: `${duration} ms`,
    result: total,
  });
}
);

app.get("/stress-test", async (req, res) => {
  try {
    const startTime = Date.now();

    // Generate a random czech word and sanitize it
    const randomWord = generate();

    const sanitizedRandomWord = sanitizeName(randomWord);

    // Trigger the cross-collection search
    const db = client.db(MESSAGE_DATABASE);

    // Fetch all collection names
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map((c) => c.name);

    // Construct the initial pipeline with $match and $addFields for the first collection
    const initialPipeline = [
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

    // Dynamically add $unionWith stages for the remaining collections
    const unionWithStages = collectionNames.slice(1).map((collectionName) => ({
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

    const finalPipeline = initialPipeline.concat(unionWithStages);

    const potentialMatches = await db
      .collection(collectionNames[0])
      .aggregate(finalPipeline)
      .toArray();

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Respond with the time taken to complete the stress test
    res.json({
      message: "Stress test completed successfully",
      searchString: randomWord,
      duration: `${duration} ms`,
      searchMatches: potentialMatches.length,
      randomMatch:
        potentialMatches[Math.floor(Math.random() * potentialMatches.length)],
      data: potentialMatches,
    });
  } catch (error) {
    console.error("Error during stress-test:", error);
    res
      .status(500)
      .json({ error: "An error occurred during the stress test." });
  }
});

app.listen(port, () => {
  console.log(`Server listening on port number: ${port}`);
});

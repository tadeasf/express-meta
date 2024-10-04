import { Elysia } from "elysia";
import path from "path";
import fs from "fs/promises";

const inboxPath = path.join(__dirname, "..", "..", "inbox");

export const serveInboxRoutes = new Elysia()
  .get("/inbox/*", async ({ params, set }) => {
    const filePath = path.join(inboxPath, params["*"]);

    try {
      const stat = await fs.stat(filePath);

      if (stat.isFile()) {
        set.headers['Content-Type'] = 'image/jpeg';  // Adjust based on your file types
        return Bun.file(filePath);
      } else {
        set.status = 404;
        return "Not Found";
      }
    } catch (error) {
      set.status = 404;
      return "Not Found";
    }
  });

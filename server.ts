import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.get("/api/sheet", async (req, res) => {
    const { id, gid } = req.query;
    if (!id || typeof id !== "string") {
      res.status(400).json({ error: "Missing sheet ID" });
      return;
    }

    try {
      let url = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv`;
      if (gid && typeof gid === "string") {
        url += `&gid=${gid}`;
      }
      const response = await fetch(url);
      
      if (!response.ok) {
        res.status(response.status).json({ error: "Failed to fetch from Google Sheets" });
        return;
      }
      
      const text = await response.text();
      res.setHeader("Content-Type", "text/csv");
      res.send(text);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Server error proxying sheet" });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

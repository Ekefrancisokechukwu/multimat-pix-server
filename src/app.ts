import dotenv from "dotenv";
dotenv.config();

import express, { Express, Request, Response } from "express";
import cors from "cors";
import fs from "fs";
import multer from "multer";
import path from "path";
import { convertImageToFormats } from "./utils/sharpTransform";

const app: Express = express();

import rateLimit from "express-rate-limit";

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: "Too many uploads from this IP, please try again after an hour.",
  standardHeaders: true,
  legacyHeaders: false,
});

const allowedOrigins = [
  "https://multi-mat-pix.vercel.app",
  "http://localhost:5173/",
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
  })
);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "./uploads"; // file upload base
    if (!fs.existsSync(dir)) fs.mkdirSync(dir); // if no such diretory  create one else ignore
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext);
    cb(null, `${base}-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB in bytes
  },
});

app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ error: "File size exceeds 10MB." });
    }
    next(err);
  }
);

app.post(
  "/upload",
  uploadLimiter as unknown as express.RequestHandler,
  upload.single("image"),
  async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No image uploaded." });

    try {
      const filePath = req.file.path;
      const baseName = path.parse(req.file.filename).name;

      const transformedPaths = await convertImageToFormats(filePath, baseName);

      res.json({
        original: `/uploads/${req.file.filename}`,
        formats: transformedPaths,
      });

      setTimeout(async () => {
        try {
          fs.unlinkSync(filePath);
          const formats = Object.values(transformedPaths);
          await Promise.all(
            formats.map(async (urlPath) => {
              const localPath = path.join(__dirname, `../${urlPath.path}`);
              fs.unlinkSync(localPath);
            })
          );
          console.log("🧹 Cleaned up uploaded files.");
        } catch (err) {
          console.error("❌ Cleanup failed:", err);
        }
      }, 60 * 60 * 1000);
    } catch (err) {
      console.error(err);

      res.status(500).json({ error: "Failed to process image." });
    }
  }
);

app.get("/download/:filename", (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(__dirname, "../uploads", filename);

  res.download(filePath, filename, (err) => {
    if (err) {
      console.error("Download error:", err);
      res.status(404).send("File not found");
    }
  });
});

app.get("/", (req: Request, res: Response) => {
  res.json({ message: "Welcome to the Image Multimat  API" });
});

export default app;

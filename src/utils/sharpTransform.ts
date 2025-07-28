import path from "path";
import fs from "fs";
import sharp from "sharp";

const outputFormats = ["jpeg", "png", "webp", "avif"] as const;
type Format = (typeof outputFormats)[number];

type File = {
  path: string;
  sizeInBytes: number;
};

const BASE_URL = process.env.BASE_URL || "http://localhost:5000";

export const convertImageToFormats = async (
  inputPath: string,
  filename: string
): Promise<{ [key in Format]: File }> => {
  const outputDir = path.join(__dirname, "../../uploads");
  fs.mkdirSync(outputDir, { recursive: true });

  const results: { [key in Format]?: File } = {};

  await Promise.all(
    outputFormats.map(async (format) => {
      const outPath = path.join(outputDir, `${filename}-converted.${format}`);
      await sharp(inputPath).toFormat(format).toFile(outPath);

      const { size } = fs.statSync(outPath);

      results[format] = {
        path: `/uploads/${filename}-converted.${format}`,
        sizeInBytes: size,
      };
    })
  );

  return results as { [key in Format]: File };
};

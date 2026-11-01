import fs from "fs";
import path from "path";

const userRoutePath = path.resolve("HealPointBackend/routes/userRoutes.js");
let content = fs.readFileSync(userRoutePath, "utf8");

if (!content.includes("ALLOWED_MIME_TYPES")) {
  const oldCode = `const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});`;

  const newCode = `const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only JPEG, PNG, WebP, and PDF documents are allowed."), false);
    }
  },
});`;

  content = content.replace(oldCode, newCode);
  if (!content.includes("ALLOWED_MIME_TYPES")) {
    // CRLF replace
    content = content.replace(
      oldCode.replace(/\n/g, "\r\n"),
      newCode.replace(/\n/g, "\r\n")
    );
  }

  fs.writeFileSync(userRoutePath, content, "utf8");
  console.log("Patched userRoutes.js with secure fileFilter");
}


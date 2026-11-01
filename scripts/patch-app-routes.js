import fs from "fs";
import path from "path";

const appPath = path.resolve("HealPointBackend/app.js");
let content = fs.readFileSync(appPath, "utf8");

if (!content.includes("clinicalReferralRoutes")) {
  content = content.replace(
    'import familyRoutes from "./routes/familyRoutes.js";',
    'import familyRoutes from "./routes/familyRoutes.js";\nimport clinicalReferralRoutes from "./routes/clinicalReferralRoutes.js";\nimport clinicalHandoverRoutes from "./routes/clinicalHandoverRoutes.js";\nimport communityRoutes from "./routes/communityRoutes.js";'
  );

  content = content.replace(
    'app.use("/api/v1/family", familyRoutes);',
    'app.use("/api/v1/family", familyRoutes);\napp.use("/api/v1/clinical-referral", clinicalReferralRoutes);\napp.use("/api/v1/clinical-handover", clinicalHandoverRoutes);\napp.use("/api/v1/community", communityRoutes);'
  );

  fs.writeFileSync(appPath, content, "utf8");
  console.log("Patched app.js with referral, handover, and community routes");
}


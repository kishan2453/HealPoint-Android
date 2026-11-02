const fs = require("fs");
const path = require("path");

const appPath = path.join(__dirname, "../HealPointBackend/app.js");
let app = fs.readFileSync(appPath, "utf8");

if (!app.includes("serviceDeskRoutes")) {
  app = app.replace(
    'import communityRoutes from "./routes/communityRoutes.js";',
    'import communityRoutes from "./routes/communityRoutes.js";\nimport serviceDeskRoutes from "./routes/serviceDeskRoutes.js";'
  );

  const targetMount = 'app.use("/api/v1/community", communityRoutes);';
  const mountAddition = `${targetMount}\napp.use("/api/v1/service-desk", serviceDeskRoutes);\napp.use("/service-desk", serviceDeskRoutes);\napp.use("/api/v1/support", serviceDeskRoutes);`;
  app = app.replace(targetMount, mountAddition);

  fs.writeFileSync(appPath, app, "utf8");
  console.log("Updated app.js with serviceDeskRoutes");
} else {
  console.log("app.js already has serviceDeskRoutes");
}


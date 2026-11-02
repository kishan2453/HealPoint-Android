const fs = require("fs");
const path = require("path");

const ctrlPath = path.join(__dirname, "../HealPointBackend/controllers/userController.js");
let ctrl = fs.readFileSync(ctrlPath, "utf8");

// 1. Add fields to allowed array
if (!ctrl.includes('"languagePreference"')) {
  ctrl = ctrl.replace(
    '"image",',
    `"image",\n      "languagePreference",\n      "accessibilityPreferences",\n      "notificationPreferences",`
  );
}

// 2. Add updateUserPreferences and getUserPreferences
if (!ctrl.includes("updateUserPreferences")) {
  const funcToAdd = `
export const updateUserPreferences = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }
    const { languagePreference, accessibilityPreferences, notificationPreferences } = req.body;
    const updates = {};
    if (languagePreference && ["en", "hi", "gu"].includes(languagePreference)) {
      updates.languagePreference = languagePreference;
    }
    if (accessibilityPreferences && typeof accessibilityPreferences === "object") {
      updates.accessibilityPreferences = accessibilityPreferences;
    }
    if (notificationPreferences && typeof notificationPreferences === "object") {
      updates.notificationPreferences = notificationPreferences;
    }

    const user = await userModel.findByIdAndUpdate(userId, { $set: updates }, { new: true }).select("-password");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    return res.status(200).json({
      success: true,
      message: "Preferences updated successfully",
      user,
      preferences: {
        languagePreference: user.languagePreference || "en",
        accessibilityPreferences: user.accessibilityPreferences || {},
        notificationPreferences: user.notificationPreferences || {},
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getUserPreferences = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }
    const user = await userModel.findById(userId).select("languagePreference accessibilityPreferences notificationPreferences");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    return res.status(200).json({
      success: true,
      preferences: {
        languagePreference: user.languagePreference || "en",
        accessibilityPreferences: user.accessibilityPreferences || { highContrast: false, fontScale: "normal", reduceMotion: false },
        notificationPreferences: user.notificationPreferences || {},
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
`;
  ctrl += funcToAdd;
  fs.writeFileSync(ctrlPath, ctrl, "utf8");
  console.log("Updated userController.js");
} else {
  console.log("userController.js already has updateUserPreferences");
}

// 3. Update userRoutes.js
const routesPath = path.join(__dirname, "../HealPointBackend/routes/userRoutes.js");
let routes = fs.readFileSync(routesPath, "utf8");

if (!routes.includes("updateUserPreferences")) {
  // add imports
  routes = routes.replace(
    "  updateUserProfile,",
    "  updateUserProfile,\n  updateUserPreferences,\n  getUserPreferences,"
  );
  // add routes
  const routeTarget = 'router.patch("/profile", authenticate, upload.single("image"), updateUserProfile);';
  const routesToAdd = `${routeTarget}\nrouter.get("/preferences", authenticate, getUserPreferences);\nrouter.patch("/preferences", authenticate, updateUserPreferences);`;
  routes = routes.replace(routeTarget, routesToAdd);
  fs.writeFileSync(routesPath, routes, "utf8");
  console.log("Updated userRoutes.js");
} else {
  console.log("userRoutes.js already has updateUserPreferences");
}


import fs from "fs";
import path from "path";

// 1. appointmentModel.js
const apptPath = path.resolve("HealPointBackend/models/appointmentModel.js");
let apptContent = fs.readFileSync(apptPath, "utf8");

if (!apptContent.includes("appointmentSchema.index")) {
  const indexes = `
// Performance Optimization Compound Indexes
appointmentSchema.index({ userId: 1, createdAt: -1 });
appointmentSchema.index({ doctorId: 1, slotDate: 1, slotTime: 1 });
appointmentSchema.index({ hospitalId: 1, createdAt: -1 });
appointmentSchema.index({ status: 1, paymentStatus: 1 });
appointmentSchema.index({ familyMemberId: 1, status: 1 });
`;
  apptContent = apptContent.replace(
    "{ timestamps: true }\n);",
    `{ timestamps: true }\n);\n${indexes}`
  );
  if (!apptContent.includes("appointmentSchema.index")) {
    apptContent = apptContent.replace(
      "{ timestamps: true }\r\n);",
      `{ timestamps: true }\r\n);\r\n${indexes}`
    );
  }
  fs.writeFileSync(apptPath, apptContent, "utf8");
  console.log("Added compound indexes to appointmentModel.js");
}

// 2. doctorModel.js
const docPath = path.resolve("HealPointBackend/models/doctorModel.js");
let docContent = fs.readFileSync(docPath, "utf8");

if (!docContent.includes("doctorSchema.index")) {
  const indexes = `
// Performance Optimization Compound Indexes
doctorSchema.index({ hospitalId: 1, isActive: 1, verificationStatus: 1 });
doctorSchema.index({ speciality: 1, isActive: 1 });
doctorSchema.index({ rating: -1, reviewCount: -1 });
`;
  docContent = docContent.replace(
    "{ timestamps: true }\n);",
    `{ timestamps: true }\n);\n${indexes}`
  );
  if (!docContent.includes("doctorSchema.index")) {
    docContent = docContent.replace(
      "{ timestamps: true }\r\n);",
      `{ timestamps: true }\r\n);\r\n${indexes}`
    );
  }
  fs.writeFileSync(docPath, docContent, "utf8");
  console.log("Added compound indexes to doctorModel.js");
}

// 3. hospitalModel.js
const hospPath = path.resolve("HealPointBackend/models/hospitalModel.js");
let hospContent = fs.readFileSync(hospPath, "utf8");

if (!hospContent.includes("hospitalSchema.index")) {
  const indexes = `
// Performance Optimization Compound Indexes
hospitalSchema.index({ isActive: 1, rating: -1, name: 1 });
hospitalSchema.index({ "location.city": 1, isActive: 1 });
`;
  hospContent = hospContent.replace(
    "{ timestamps: true }\n);",
    `{ timestamps: true }\n);\n${indexes}`
  );
  if (!hospContent.includes("hospitalSchema.index")) {
    hospContent = hospContent.replace(
      "{ timestamps: true }\r\n);",
      `{ timestamps: true }\r\n);\r\n${indexes}`
    );
  }
  fs.writeFileSync(hospPath, hospContent, "utf8");
  console.log("Added compound indexes to hospitalModel.js");
}

// 4. reviewModel.js
const revPath = path.resolve("HealPointBackend/models/reviewModel.js");
let revContent = fs.readFileSync(revPath, "utf8");

if (!revContent.includes("reviewSchema.index")) {
  const indexes = `
// Performance Optimization Compound Indexes
reviewSchema.index({ doctorId: 1, isApproved: 1, createdAt: -1 });
reviewSchema.index({ userId: 1, createdAt: -1 });
`;
  revContent = revContent.replace(
    "{ timestamps: true }\n);",
    `{ timestamps: true }\n);\n${indexes}`
  );
  if (!revContent.includes("reviewSchema.index")) {
    revContent = revContent.replace(
      "{ timestamps: true }\r\n);",
      `{ timestamps: true }\r\n);\r\n${indexes}`
    );
  }
  fs.writeFileSync(revPath, revContent, "utf8");
  console.log("Added compound indexes to reviewModel.js");
}


import fs from "fs";

let rev = fs.readFileSync("HealPointBackend/controllers/reviewController.js", "utf8");
if (!rev.includes("dispatchNotification")) {
  rev = 'import { dispatchNotification } from "../services/socketService.js";\n' + rev;
}

const target = 'res.status(201).json({ success: true, message: "Review submitted successfully",';
const notifCode = `    try {
      if (doctor) {
        dispatchNotification({
          doctorId: doctor._id,
          recipientRole: "doctor",
          title: "New Patient Review",
          message: \`A patient left a \${rating}★ review for your consultation.\`,
          type: "review",
          category: "review",
          priority: "normal",
          link: "/reviews",
          refId: review._id.toString(),
          refModel: "Review",
        }).catch(() => {});
      }
    } catch (err) {}\n\n    `;

if (rev.includes(target) && !rev.includes('title: "New Patient Review"')) {
  rev = rev.replace(target, notifCode + target);
  console.log("Patched createReview in reviewController.js");
}
fs.writeFileSync("HealPointBackend/controllers/reviewController.js", rev, "utf8");
console.log("Wrote updated reviewController.js");


import http from "http";
import dotenv from "dotenv";
import "colors";
import app from "./app.js";
import { initSocketServer } from "./services/socketService.js";

dotenv.config();

const PORT = process.env.PORT || 8080;
const HOST = process.env.HOST || "0.0.0.0";

const server = http.createServer(app);

// Attach real-time Socket.IO server to HTTP server
initSocketServer(server);

server.listen(PORT, HOST, () => {
  console.log(
    `HealPoint Backend running in ${process.env.NODE_ENV || "development"} mode on http://${HOST}:${PORT}`
      .bgCyan.white
  );
});

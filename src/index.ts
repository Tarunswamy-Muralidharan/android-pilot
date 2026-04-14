#!/usr/bin/env node
import { createServer } from "./server.js";
import { isBridgeAvailable } from "./bridge/compose-client.js";

const server = createServer();

// Try connecting to Compose bridge on startup (non-blocking)
isBridgeAvailable().then((available) => {
  if (available) {
    console.error("[android-pilot] Compose bridge connected — fast mode enabled (<10ms hierarchy)");
  } else {
    console.error("[android-pilot] Compose bridge not available — using ADB mode (2-5s hierarchy)");
  }
}).catch(() => {});

server.start({
  transportType: "stdio",
});

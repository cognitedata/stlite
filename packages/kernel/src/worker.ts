import { startWorkerEnv } from "./worker-runtime";

self.onmessage = startWorkerEnv(
  "https://cdn.jsdelivr.net/pyodide/v0.26.0/full/pyodide.js",
  self.postMessage
);

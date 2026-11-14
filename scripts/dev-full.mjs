import { spawn } from "node:child_process";
const devEnv = { ...process.env, NODE_ENV: "development", VITE_BACKEND: "true" };
const children = [
  spawn(
    process.execPath,
    ["--env-file-if-exists=.env", "--env-file-if-exists=.env.local", "server/app.mjs"],
    { stdio: "inherit", env: devEnv },
  ),
  spawn(
    process.execPath,
    ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1"],
    { stdio: "inherit", env: devEnv },
  ),
];
let closing = false;
const stop = () => {
  if (closing) return;
  closing = true;
  children.forEach((c) => c.kill());
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
children.forEach((c) =>
  c.on("exit", () => {
    stop();
  }),
);

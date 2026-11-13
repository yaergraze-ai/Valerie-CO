import { spawn } from "node:child_process";
const children = [
  spawn(process.execPath, ["--env-file-if-exists=.env", "server/app.mjs"], { stdio: "inherit" }),
  spawn(
    process.execPath,
    ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1"],
    { stdio: "inherit", env: { ...process.env, VITE_BACKEND: "true" } },
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

import { createApp } from "../server/app.mjs";

let app;

function getApp() {
  if (!app) {
    app = createApp({
      dbPath: process.env.SQLITE_DB_PATH || "/tmp/valerie.sqlite",
    });
  }
  return app;
}

export default {
  async fetch(request) {
    return getApp().fetch(request);
  },
};


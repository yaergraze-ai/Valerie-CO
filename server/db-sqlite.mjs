import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export function createSqliteStore(dbPath) {
  if (dbPath !== ":memory:") mkdirSync(dirname(dbPath), { recursive: true });
  const sql = new DatabaseSync(dbPath);
  sql.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
 CREATE TABLE IF NOT EXISTS records(kind TEXT NOT NULL,id TEXT NOT NULL,data TEXT NOT NULL,PRIMARY KEY(kind,id));
 CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,password TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'member');
 CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS google_accounts(sub TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id));
 CREATE TABLE IF NOT EXISTS recovery(token TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS verifications(key TEXT PRIMARY KEY,code_hash TEXT NOT NULL,expires INTEGER NOT NULL,attempts INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS google_challenges(nonce TEXT PRIMARY KEY,expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS checkout_keys(user_id TEXT,key TEXT,order_id TEXT,PRIMARY KEY(user_id,key));`);

  const list = (kind) =>
    sql
      .prepare("SELECT data FROM records WHERE kind=? ORDER BY rowid DESC")
      .all(kind)
      .map((x) => JSON.parse(x.data));

  const get = (kind, id) => {
    const r = sql
      .prepare("SELECT data FROM records WHERE kind=? AND id=?")
      .get(kind, id);
    return r ? JSON.parse(r.data) : null;
  };

  const put = (kind, id, data) => {
    sql
      .prepare(
        "INSERT INTO records(kind,id,data) VALUES(?,?,?) ON CONFLICT(kind,id) DO UPDATE SET data=excluded.data",
      )
      .run(kind, id, JSON.stringify(data));
  };

  const tx = (fn) => {
    sql.exec("BEGIN IMMEDIATE");
    try {
      const result = fn();
      sql.exec("COMMIT");
      return result;
    } catch (e) {
      sql.exec("ROLLBACK");
      throw e;
    }
  };

  const fail = (status, message) =>
    Object.assign(new Error(message), { status });

  return {
    kind: "sqlite",
    sql,
    async ensureSchema() {},

    async getMeta(id) {
      return get("meta", id);
    },
    async putMeta(id, data) {
      put("meta", id, data);
    },
    async getSettings() {
      return get("settings", "main");
    },
    async putSettings(data) {
      put("settings", "main", data);
    },

    async listProducts() {
      return list("products");
    },
    async getProduct(id) {
      return get("products", id);
    },
    async putProduct(p) {
      put("products", p.id, p);
    },
    async resetAndSeedProducts(products, { clearExisting = false } = {}) {
      tx(() => {
        if (clearExisting) {
          sql.prepare("DELETE FROM records WHERE kind='products'").run();
        }
        for (const p of [...products].reverse()) {
          put("products", p.id, p);
        }
      });
    },
    async deleteProduct(id) {
      tx(() => {
        sql
          .prepare("DELETE FROM records WHERE kind='products' AND id=?")
          .run(id);
        const s = get("settings", "main");
        if (s?.homepage?.productIds?.includes(id)) {
          put("settings", "main", {
            ...s,
            homepage: {
              ...s.homepage,
              productIds: s.homepage.productIds.filter((x) => x !== id),
            },
          });
        }
      });
    },

    async listCoupons() {
      return list("coupons");
    },
    async getCoupon(code) {
      return get("coupons", code);
    },
    async putCoupon(c) {
      put("coupons", c.code, c);
    },
    async deleteCoupon(code) {
      sql.prepare("DELETE FROM records WHERE kind='coupons' AND id=?").run(code);
    },

    async listMembers() {
      const roleRows = sql.prepare("SELECT id, role FROM users").all();
      const roleMap = new Map(roleRows.map((r) => [r.id, r.role]));
      return list("members").map((m) => ({
        ...m,
        role: m.role || roleMap.get(m.id) || "member",
      }));
    },
    async getMember(id) {
      const m = get("members", id);
      if (!m) return null;
      if (m.role) return m;
      const u = sql.prepare("SELECT role FROM users WHERE id=?").get(id);
      return { ...m, role: u?.role || "member" };
    },
    async findMemberByPhone(phone) {
      return list("members").find((m) => m.phone === phone) || null;
    },
    async putMember(m) {
      put("members", m.id, m);
    },

    async listTickets() {
      return list("tickets");
    },
    async getTicket(id) {
      return get("tickets", id);
    },
    async putTicket(t) {
      put("tickets", t.id, t);
    },

    async listSubscribers() {
      return list("subscribers").map((x) => x.email);
    },
    async putSubscriber(email) {
      put("subscribers", email, { email });
    },

    async hasAdmin() {
      return !!sql
        .prepare("SELECT id FROM users WHERE role IN ('admin','super_admin') LIMIT 1")
        .get();
    },
    async getUserById(id) {
      return sql.prepare("SELECT * FROM users WHERE id=?").get(id) || null;
    },
    async getUserByEmail(email) {
      return sql.prepare("SELECT * FROM users WHERE email=?").get(email) || null;
    },
    async getUserByGoogleSub(sub) {
      return (
        sql
          .prepare(
            "SELECT u.* FROM users u JOIN google_accounts g ON g.user_id=u.id WHERE g.sub=?",
          )
          .get(sub) || null
      );
    },
    async linkGoogleAccount(sub, userId) {
      sql
        .prepare("INSERT OR REPLACE INTO google_accounts VALUES(?,?)")
        .run(sub, userId);
    },
    async createUserWithMember(user, member, googleSub = null, { ignoreConflict = false } = {}) {
      const enrichedMember =
        member && typeof member === "object"
          ? { ...member, role: member.role || user.role || "member" }
          : member;
      return tx(() => {
        if (ignoreConflict) {
          const info = sql
            .prepare("INSERT OR IGNORE INTO users VALUES(?,?,?,?)")
            .run(user.id, user.email, user.password, user.role);
          if (!info.changes) return false;
          put("members", enrichedMember.id, enrichedMember);
          return true;
        }
        sql
          .prepare("INSERT INTO users VALUES(?,?,?,?)")
          .run(user.id, user.email, user.password, user.role);
        if (googleSub) {
          sql
            .prepare("INSERT INTO google_accounts VALUES(?,?)")
            .run(googleSub, user.id);
        }
        put("members", enrichedMember.id, enrichedMember);
        return true;
      });
    },

    async getSessionUser(tokenHash, now) {
      return (
        sql
          .prepare(
            "SELECT u.id,u.email,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires>?",
          )
          .get(tokenHash, now) || null
      );
    },
    async createSession(tokenHash, userId, expiresAt, now) {
      sql.prepare("DELETE FROM sessions WHERE expires<?").run(now);
      sql
        .prepare("INSERT INTO sessions VALUES(?,?,?)")
        .run(tokenHash, userId, expiresAt);
    },
    async deleteSession(tokenHash) {
      sql.prepare("DELETE FROM sessions WHERE token=?").run(tokenHash);
    },
    async updatePasswordAndClearSessions(userId, passwordHash) {
      tx(() => {
        sql
          .prepare("UPDATE users SET password=? WHERE id=?")
          .run(passwordHash, userId);
        sql.prepare("DELETE FROM sessions WHERE user_id=?").run(userId);
      });
    },
    async updateUserRole(userId, role) {
      tx(() => {
        sql.prepare("UPDATE users SET role=? WHERE id=?").run(role, userId);
        const member = get("members", userId);
        if (member) {
          put("members", userId, { ...member, role });
        }
      });
    },

    async saveGoogleChallenge(nonceHash, expiresAt, now) {
      sql.prepare("DELETE FROM google_challenges WHERE expires<?").run(now);
      sql
        .prepare("INSERT INTO google_challenges VALUES(?,?)")
        .run(nonceHash, expiresAt);
    },
    async consumeGoogleChallenge(nonceHash, now) {
      return !!sql
        .prepare(
          "DELETE FROM google_challenges WHERE nonce=? AND expires>? RETURNING nonce",
        )
        .get(nonceHash, now);
    },

    async saveRecoveryToken(tokenHash, userId, expiresAt, now) {
      tx(() => {
        sql
          .prepare("DELETE FROM recovery WHERE user_id=? OR expires<?")
          .run(userId, now);
        sql
          .prepare("INSERT INTO recovery VALUES(?,?,?)")
          .run(tokenHash, userId, expiresAt);
      });
    },
    async deleteRecoveryToken(tokenHash) {
      sql.prepare("DELETE FROM recovery WHERE token=?").run(tokenHash);
    },
    async resetPasswordWithToken(tokenHash, now, newPasswordHash) {
      return tx(() => {
        const r = sql
          .prepare(
            "DELETE FROM recovery WHERE token=? AND expires>? RETURNING user_id",
          )
          .get(tokenHash, now);
        if (!r) return false;
        sql
          .prepare("UPDATE users SET password=? WHERE id=?")
          .run(newPasswordHash, r.user_id);
        sql.prepare("DELETE FROM sessions WHERE user_id=?").run(r.user_id);
        return true;
      });
    },

    async upsertVerificationCode(key, codeHash, expiresAt, now) {
      sql
        .prepare("DELETE FROM verifications WHERE key=? OR expires<?")
        .run(key, now);
      sql
        .prepare("INSERT INTO verifications VALUES(?,?,?,0)")
        .run(key, codeHash, expiresAt);
    },
    async getVerificationCode(key, now) {
      return (
        sql
          .prepare("SELECT * FROM verifications WHERE key=? AND expires>?")
          .get(key, now) || null
      );
    },
    async incrementVerificationAttempts(key) {
      sql
        .prepare("UPDATE verifications SET attempts=attempts+1 WHERE key=?")
        .run(key);
    },
    async deleteVerificationCode(key) {
      sql.prepare("DELETE FROM verifications WHERE key=?").run(key);
    },

    async listOrders() {
      return list("orders");
    },
    async getOrder(id) {
      return get("orders", id);
    },
    async getOrderByCheckoutKey(userId, key) {
      const prev = sql
        .prepare("SELECT order_id FROM checkout_keys WHERE user_id=? AND key=?")
        .get(userId, key);
      return prev ? get("orders", prev.order_id) : null;
    },
    async createOrderAtomic(userId, key, buildOrderFn) {
      return tx(() => {
        const previous = sql
          .prepare("SELECT order_id FROM checkout_keys WHERE user_id=? AND key=?")
          .get(userId, key);
        if (previous) {
          return { duplicate: true, order: get("orders", previous.order_id) };
        }
        const catalog = new Map(list("products").map((p) => [p.id, p]));
        const order = buildOrderFn(catalog, (code) => get("coupons", code));
        const quantities = new Map();
        for (const item of order.items) {
          quantities.set(
            item.productId,
            (quantities.get(item.productId) || 0) + item.quantity,
          );
        }
        for (const [id, qty] of quantities) {
          const p = catalog.get(id);
          if (!p?.active) throw fail(409, "A product is unavailable");
          if (p.stock < qty) throw fail(409, "Insufficient stock");
          put("products", id, { ...p, stock: p.stock - qty });
        }
        put("orders", order.id, order);
        sql
          .prepare("INSERT INTO checkout_keys VALUES(?,?,?)")
          .run(userId, key, order.id);
        return { duplicate: false, order };
      });
    },
    async transitionOrderAtomic({
      orderId,
      expectedStatus,
      expectedPaymentStatus,
      nextOrder,
      restoreStock,
    }) {
      return tx(() => {
        const current = get("orders", orderId);
        if (!current) throw fail(404, "Order not found");
        if (expectedStatus !== null && expectedStatus !== undefined && current.status !== expectedStatus) {
          throw fail(409, "Order state changed concurrently");
        }
        if (
          expectedPaymentStatus !== null &&
          expectedPaymentStatus !== undefined &&
          (current.payment?.status || "") !== expectedPaymentStatus
        ) {
          throw fail(409, "Order payment state changed concurrently");
        }
        if (restoreStock) {
          for (const item of nextOrder.items) {
            const p = get("products", item.productId);
            if (p) put("products", p.id, { ...p, stock: p.stock + item.quantity });
          }
        }
        put("orders", orderId, nextOrder);
        return nextOrder;
      });
    },
    async saveOrder(order) {
      put("orders", order.id, order);
      return order;
    },

    async applyOps(ops) {
      tx(() => {
        for (const op of ops) {
          if (op.kind === "products") put("products", op.data.id, op.data);
          else if (op.kind === "products_delete") {
            sql
              .prepare("DELETE FROM records WHERE kind='products' AND id=?")
              .run(op.id);
            const s = get("settings", "main");
            if (s?.homepage?.productIds?.includes(op.id)) {
              put("settings", "main", {
                ...s,
                homepage: {
                  ...s.homepage,
                  productIds: s.homepage.productIds.filter((x) => x !== op.id),
                },
              });
            }
          } else if (op.kind === "coupons") put("coupons", op.data.code, op.data);
          else if (op.kind === "coupons_delete") {
            sql
              .prepare("DELETE FROM records WHERE kind='coupons' AND id=?")
              .run(op.code);
          } else if (op.kind === "settings") put("settings", "main", op.data);
          else if (op.kind === "members") put("members", op.data.id, op.data);
          else if (op.kind === "tickets") put("tickets", op.data.id, op.data);
          else if (op.kind === "subscribers")
            put("subscribers", op.email, { email: op.email });
        }
      });
    },

    close() {
      sql.close();
    },
  };
}


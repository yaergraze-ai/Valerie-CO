import { createClient } from "@supabase/supabase-js";

const PAGE_SIZE = 1000;

function fail(status, message, extra = {}) {
  return Object.assign(new Error(message), { status, ...extra });
}

function unwrap({ data, error }, context = "Supabase request failed") {
  if (!error) return data;
  const code = String(error.code || "");
  const msg = String(error.message || context);
  if (
    code === "PGRST205" ||
    code === "42P01" ||
    msg.includes("Could not find the table") ||
    msg.includes("does not exist")
  ) {
    throw fail(
      503,
      "Supabase schema not initialized. Run supabase/migrations/202611130001_valerie_store.sql in Supabase SQL Editor.",
      { schemaMissing: true },
    );
  }
  if (code === "P0001" || code === "P0003" || code === "23505") {
    throw fail(409, msg || "Conflict");
  }
  if (code === "P0002") {
    throw fail(msg.includes("Order") ? 404 : 409, msg || "Not found");
  }
  throw fail(502, msg || context);
}

const mapProduct = (row) => ({
  ...row.data,
  id: row.id,
  name: row.name,
  brand: row.brand,
  category: row.category,
  ...(row.sub_category ? { subCategory: row.sub_category } : {}),
  price: Number(row.price),
  ...(row.price_idr != null ? { priceIdr: Number(row.price_idr) } : {}),
  stock: Number(row.stock),
  active: Boolean(row.active),
  fresh: Boolean(row.fresh),
});

const toProductRow = (p) => ({
  id: p.id,
  name: p.name,
  brand: p.brand,
  category: p.category,
  sub_category: p.subCategory || null,
  price: p.price,
  price_idr: p.priceIdr ?? null,
  stock: p.stock,
  active: !!p.active,
  fresh: !!p.fresh,
  data: p,
  updated_at: new Date().toISOString(),
});

const toOrderRow = (o) => ({
  id: o.id,
  receipt_number: o.receiptNumber || null,
  member_id: o.memberId,
  status: o.status,
  currency: o.currency || "USD",
  total: o.total,
  payment_method: o.paymentMethod || "direct",
  payment_status: o.payment?.status || null,
  data: o,
  updated_at: new Date().toISOString(),
});

export function createSupabaseStore({ url, secretKey, client = null } = {}) {
  const sb =
    client ||
    createClient(url, secretKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

  async function fetchAll(table, orderCol = "seq", ascending = false, columns = "*") {
    const rows = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      let query = sb.from(table).select(columns).range(from, from + PAGE_SIZE - 1);
      if (orderCol) query = query.order(orderCol, { ascending });
      const page = unwrap(await query, `Failed to list ${table}`);
      if (!page?.length) break;
      rows.push(...page);
      if (page.length < PAGE_SIZE) break;
    }
    return rows;
  }

  return {
    kind: "supabase",
    sql: null,
    client: sb,

    async ensureSchema() {
      unwrap(
        await sb.from("app_meta").select("id").limit(1),
        "Failed to verify Supabase schema",
      );
    },

    async getMeta(id) {
      const row = unwrap(
        await sb.from("app_meta").select("data").eq("id", id).maybeSingle(),
      );
      return row?.data || null;
    },
    async putMeta(id, data) {
      unwrap(
        await sb.from("app_meta").upsert(
          { id, data, updated_at: new Date().toISOString() },
          { onConflict: "id" },
        ),
      );
    },

    async getSettings() {
      const row = unwrap(
        await sb
          .from("store_settings")
          .select("data")
          .eq("id", "main")
          .maybeSingle(),
      );
      return row?.data || null;
    },
    async putSettings(data) {
      unwrap(
        await sb.from("store_settings").upsert(
          { id: "main", data, updated_at: new Date().toISOString() },
          { onConflict: "id" },
        ),
      );
    },

    async listProducts() {
      const rows = await fetchAll("products", "seq", false);
      return rows.map(mapProduct);
    },
    async getProduct(id) {
      const row = unwrap(
        await sb.from("products").select("*").eq("id", id).maybeSingle(),
      );
      return row ? mapProduct(row) : null;
    },
    async putProduct(p) {
      unwrap(
        await sb
          .from("products")
          .upsert(toProductRow(p), { onConflict: "id" }),
      );
    },
    async resetAndSeedProducts(products, { clearExisting = false } = {}) {
      if (clearExisting) {
        unwrap(await sb.from("products").delete().neq("id", ""));
      }
      const ordered = [...products].reverse().map(toProductRow);
      if (!ordered.length) return;
      unwrap(
        await sb.from("products").upsert(ordered, { onConflict: "id" }),
      );
    },
    async deleteProduct(id) {
      unwrap(await sb.rpc("vco_delete_product_tx", { p_product_id: id }));
    },

    async listCoupons() {
      const rows = await fetchAll("coupons", "seq", false);
      return rows.map((r) => ({
        code: r.code,
        percent: Number(r.percent),
        active: Boolean(r.active),
      }));
    },
    async getCoupon(code) {
      const row = unwrap(
        await sb
          .from("coupons")
          .select("code, percent, active")
          .eq("code", code)
          .maybeSingle(),
      );
      return row
        ? { code: row.code, percent: Number(row.percent), active: Boolean(row.active) }
        : null;
    },
    async putCoupon(c) {
      unwrap(
        await sb.from("coupons").upsert(
          { code: c.code, percent: c.percent, active: !!c.active },
          { onConflict: "code" },
        ),
      );
    },
    async deleteCoupon(code) {
      unwrap(await sb.from("coupons").delete().eq("code", code));
    },

    async listMembers() {
      const rows = await fetchAll("members", "seq", false, "data");
      return rows.map((r) => r.data);
    },
    async getMember(id) {
      const row = unwrap(
        await sb.from("members").select("data").eq("id", id).maybeSingle(),
      );
      return row?.data || null;
    },
    async findMemberByPhone(phone) {
      const row = unwrap(
        await sb
          .from("members")
          .select("data")
          .eq("phone", phone)
          .limit(1)
          .maybeSingle(),
      );
      return row?.data || null;
    },
    async putMember(m) {
      unwrap(
        await sb.from("members").upsert(
          {
            id: m.id,
            email: m.email,
            phone: m.phone || "",
            name: m.name || "",
            data: m,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" },
        ),
      );
    },

    async listTickets() {
      const rows = await fetchAll("tickets", "seq", false, "data");
      return rows.map((r) => r.data);
    },
    async getTicket(id) {
      const row = unwrap(
        await sb.from("tickets").select("data").eq("id", id).maybeSingle(),
      );
      return row?.data || null;
    },
    async putTicket(t) {
      unwrap(
        await sb.from("tickets").upsert(
          {
            id: t.id,
            member_id: t.memberId,
            status: t.status || "open",
            data: t,
          },
          { onConflict: "id" },
        ),
      );
    },

    async listSubscribers() {
      const rows = await fetchAll("subscribers", "seq", false, "email");
      return rows.map((r) => r.email);
    },
    async putSubscriber(email) {
      unwrap(
        await sb
          .from("subscribers")
          .upsert({ email }, { onConflict: "email" }),
      );
    },

    async hasAdmin() {
      const rows = unwrap(
        await sb.from("app_users").select("id").eq("role", "admin").limit(1),
      );
      return (rows?.length || 0) > 0;
    },
    async getUserById(id) {
      const row = unwrap(
        await sb
          .from("app_users")
          .select("id, email, password_hash, role")
          .eq("id", id)
          .maybeSingle(),
      );
      return row
        ? { id: row.id, email: row.email, password: row.password_hash, role: row.role }
        : null;
    },
    async getUserByEmail(email) {
      const row = unwrap(
        await sb
          .from("app_users")
          .select("id, email, password_hash, role")
          .eq("email", email)
          .maybeSingle(),
      );
      return row
        ? { id: row.id, email: row.email, password: row.password_hash, role: row.role }
        : null;
    },
    async getUserByGoogleSub(sub) {
      const link = unwrap(
        await sb
          .from("google_accounts")
          .select("user_id")
          .eq("sub", sub)
          .maybeSingle(),
      );
      if (!link?.user_id) return null;
      return this.getUserById(link.user_id);
    },
    async createUserWithMember(
      user,
      member,
      googleSub = null,
      { ignoreConflict = false } = {},
    ) {
      try {
        unwrap(
          await sb.rpc("vco_create_user_tx", {
            p_id: user.id,
            p_email: user.email,
            p_password_hash: user.password,
            p_role: user.role,
            p_member: member,
            p_google_sub: googleSub,
          }),
        );
        return true;
      } catch (e) {
        if (ignoreConflict && e.status === 409) return false;
        throw e;
      }
    },

    async getSessionUser(tokenHash, now) {
      const row = unwrap(
        await sb
          .from("app_sessions")
          .select("app_users(id, email, role)")
          .eq("token", tokenHash)
          .gt("expires_at", now)
          .maybeSingle(),
      );
      const user = Array.isArray(row?.app_users)
        ? row.app_users[0]
        : row?.app_users;
      return user ? { id: user.id, email: user.email, role: user.role } : null;
    },
    async createSession(tokenHash, userId, expiresAt, now) {
      unwrap(await sb.from("app_sessions").delete().lt("expires_at", now));
      unwrap(
        await sb.from("app_sessions").insert({
          token: tokenHash,
          user_id: userId,
          expires_at: expiresAt,
        }),
      );
    },
    async deleteSession(tokenHash) {
      unwrap(await sb.from("app_sessions").delete().eq("token", tokenHash));
    },
    async updatePasswordAndClearSessions(userId, passwordHash) {
      unwrap(
        await sb.rpc("vco_update_password_tx", {
          p_user_id: userId,
          p_password_hash: passwordHash,
        }),
      );
    },
    async updateUserRole(userId, role) {
      const dbRole =
        role === "admin" || role === "super_admin" ? "admin" : "member";
      unwrap(
        await sb.from("app_users").update({ role: dbRole }).eq("id", userId),
      );
      const member = await this.getMember(userId);
      if (member) {
        await this.putMember({ ...member, role });
      }
    },

    async saveGoogleChallenge(nonceHash, expiresAt, now) {
      unwrap(await sb.from("google_challenges").delete().lt("expires_at", now));
      unwrap(
        await sb.from("google_challenges").insert({
          nonce: nonceHash,
          expires_at: expiresAt,
        }),
      );
    },
    async consumeGoogleChallenge(nonceHash, now) {
      return Boolean(
        unwrap(
          await sb.rpc("vco_consume_google_challenge", {
            p_nonce: nonceHash,
            p_now: now,
          }),
        ),
      );
    },

    async saveRecoveryToken(tokenHash, userId, expiresAt, now) {
      unwrap(await sb.from("recovery_tokens").delete().eq("user_id", userId));
      unwrap(await sb.from("recovery_tokens").delete().lt("expires_at", now));
      unwrap(
        await sb.from("recovery_tokens").insert({
          token: tokenHash,
          user_id: userId,
          expires_at: expiresAt,
        }),
      );
    },
    async deleteRecoveryToken(tokenHash) {
      unwrap(await sb.from("recovery_tokens").delete().eq("token", tokenHash));
    },
    async resetPasswordWithToken(tokenHash, now, newPasswordHash) {
      return Boolean(
        unwrap(
          await sb.rpc("vco_reset_password_tx", {
            p_token: tokenHash,
            p_now: now,
            p_password_hash: newPasswordHash,
          }),
        ),
      );
    },

    async upsertVerificationCode(key, codeHash, expiresAt, now) {
      unwrap(await sb.from("verification_codes").delete().eq("key", key));
      unwrap(await sb.from("verification_codes").delete().lt("expires_at", now));
      unwrap(
        await sb.from("verification_codes").insert({
          key,
          code_hash: codeHash,
          expires_at: expiresAt,
          attempts: 0,
        }),
      );
    },
    async getVerificationCode(key, now) {
      const row = unwrap(
        await sb
          .from("verification_codes")
          .select("*")
          .eq("key", key)
          .gt("expires_at", now)
          .maybeSingle(),
      );
      return row || null;
    },
    async incrementVerificationAttempts(key) {
      const current = unwrap(
        await sb
          .from("verification_codes")
          .select("attempts")
          .eq("key", key)
          .maybeSingle(),
      );
      if (current) {
        unwrap(
          await sb
            .from("verification_codes")
            .update({ attempts: Number(current.attempts || 0) + 1 })
            .eq("key", key),
        );
      }
    },
    async deleteVerificationCode(key) {
      unwrap(await sb.from("verification_codes").delete().eq("key", key));
    },

    async listOrders() {
      const rows = await fetchAll("orders", "seq", false, "data");
      return rows.map((r) => r.data);
    },
    async getOrder(id) {
      const row = unwrap(
        await sb.from("orders").select("data").eq("id", id).maybeSingle(),
      );
      return row?.data || null;
    },
    async getOrderByCheckoutKey(userId, key) {
      const ck = unwrap(
        await sb
          .from("checkout_keys")
          .select("order_id")
          .eq("user_id", userId)
          .eq("key", key)
          .maybeSingle(),
      );
      if (!ck?.order_id) return null;
      return this.getOrder(ck.order_id);
    },
    async createOrderAtomic(userId, key, buildOrderFn) {
      const existing = await this.getOrderByCheckoutKey(userId, key);
      if (existing) return { duplicate: true, order: existing };

      const [products, coupons] = await Promise.all([
        this.listProducts(),
        this.listCoupons(),
      ]);
      const catalog = new Map(products.map((p) => [p.id, p]));
      const couponMap = new Map(coupons.map((c) => [c.code, c]));
      const order = buildOrderFn(catalog, (code) => couponMap.get(code) || null);

      const res = unwrap(
        await sb.rpc("vco_create_order_tx", {
          p_user_id: userId,
          p_key: key,
          p_order: order,
        }),
      );
      return {
        duplicate: Boolean(res?.duplicate),
        order: res?.order || order,
      };
    },
    async transitionOrderAtomic({
      orderId,
      expectedStatus,
      expectedPaymentStatus,
      nextOrder,
      restoreStock,
    }) {
      const updated = unwrap(
        await sb.rpc("vco_transition_order_tx", {
          p_order_id: orderId,
          p_expected_status: expectedStatus ?? null,
          p_expected_payment_status: expectedPaymentStatus ?? null,
          p_next_order: nextOrder,
          p_restore_stock: Boolean(restoreStock),
        }),
      );
      return updated || nextOrder;
    },
    async saveOrder(order) {
      unwrap(
        await sb
          .from("orders")
          .upsert(toOrderRow(order), { onConflict: "id" }),
      );
      return order;
    },

    async applyOps(ops) {
      for (const op of ops) {
        if (op.kind === "products") await this.putProduct(op.data);
        else if (op.kind === "products_delete") await this.deleteProduct(op.id);
        else if (op.kind === "coupons") await this.putCoupon(op.data);
        else if (op.kind === "coupons_delete") await this.deleteCoupon(op.code);
        else if (op.kind === "settings") await this.putSettings(op.data);
        else if (op.kind === "members") await this.putMember(op.data);
        else if (op.kind === "tickets") await this.putTicket(op.data);
        else if (op.kind === "subscribers") await this.putSubscriber(op.email);
      }
    },

    close() {},
  };
}

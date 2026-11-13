import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  type SetStateAction,
  type ReactNode,
} from "react";
import { api, serverMode } from "./backend";
import { initialCatalog, type Item, type Lang } from "./catalog";
import {
  addLine,
  itemPrice,
  totals,
  validateBag,
  type BagLine,
  type Coupon,
  type Currency,
} from "./commerce";
export type Address = {
  id: string;
  label: string;
  name: string;
  phone: string;
  street: string;
  city: string;
  postal: string;
};
export type MemberSecurity = {
  twoFactorEnabled?: boolean;
  loginAlerts?: boolean;
  sessionTimeout?: "7d" | "24h" | "strict";
  recoveryEmail?: string;
  lastPasswordChange?: string;
};
export type Member = {
  id: string;
  name: string;
  email: string;
  phone: string;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  avatar?: string;
  bio?: string;
  preferredSize?: number;
  preferences?: {
    promoEmails?: boolean;
    orderAlerts?: boolean;
  };
  security?: MemberSecurity;
  addresses: Address[];
};
export type OrderRefund = {
  status: "requested" | "refunded" | "rejected";
  amount: number;
  currency: "USD" | "IDR";
  reason: string;
  requestedAt: string;
  refundedAt?: string;
  refundedBy?: string;
  reference?: string;
  note?: string;
};
export type Order = {
  id: string;
  receiptNumber?: string;
  memberId: string;
  name: string;
  email: string;
  date: string;
  status: "processing" | "shipped" | "delivered" | "cancelled";
  paymentMethod?: "midtrans" | "direct";
  items: (BagLine & {
    productCode?: string;
    name: string;
    image: string;
    price: number;
  })[];
  total: number;
  shipping: number;
  discount: number;
  address: Address;
  tracking: string;
  currency?: "USD" | "IDR";
  payment?: {
    provider: "midtrans";
    status: "pending" | "paid" | "failed" | "refunded";
    url?: string;
    sandbox: boolean;
    method?: string;
    transactionId?: string;
    paidAt?: string;
    refundedAt?: string;
    updatedAt?: string;
  };
  refund?: OrderRefund;
};
export function nextProductCode(
  products: Item[],
  category: Item["category"] = "Sneakers",
) {
  const prefix =
    category === "Boots"
      ? "BT"
      : category === "Heels"
        ? "HL"
        : category === "Flatshoes"
          ? "FL"
          : "SNK";
  let maxSeq = products.length;
  const used = new Set<string>();
  for (const p of products) {
    const code = (p.details?.code || "").toUpperCase();
    if (code) used.add(code);
    const match = code.match(/(\d+)$/);
    if (match) {
      const n = Number(match[1]);
      if (Number.isFinite(n) && n > maxSeq) maxSeq = n;
    }
  }
  let seq = maxSeq + 1;
  let candidate = `VCO-${prefix}-${String(seq).padStart(3, "0")}`;
  while (used.has(candidate)) {
    seq++;
    candidate = `VCO-${prefix}-${String(seq).padStart(3, "0")}`;
  }
  return candidate;
}
export function buildProductId(name: string, products: Item[]) {
  const slug =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 32) || "item";
  const ids = new Set(products.map((p) => p.id));
  let idx = products.length + 1;
  let candidate = `vco-${slug}-${String(idx).padStart(3, "0")}`;
  while (ids.has(candidate)) {
    idx++;
    candidate = `vco-${slug}-${String(idx).padStart(3, "0")}`;
  }
  return candidate;
}
export type Ticket = {
  id: string;
  memberId: string;
  subject: string;
  message: string;
  reply: string;
  status: "open" | "closed";
  date: string;
};
type Database = {
  paymentConfig?: {
    enabled: boolean;
    production: boolean;
    shipping: { standard: number; express: number; freeAbove: number };
  };
  sales?: Record<string, number>;
  products: Item[];
  bag: BagLine[];
  favorites: string[];
  members: Member[];
  orders: Order[];
  coupons: Coupon[];
  tickets: Ticket[];
  subscribers: string[];
  settings: {
    homepage?: import("./showcase-data").HomepageSelection;
    name: string;
    email: string;
    announcement: { id: string; en: string };
  };
};
const envMeta = (import.meta as any).env || {};
const initial: Database = {
  products: initialCatalog,
  bag: [],
  favorites: [],
  members: [],
  orders: [],
  coupons: [
    { code: "WELCOME10", percent: 10, active: true },
    { code: "SOLERE20", percent: 20, active: true },
  ],
  tickets: [],
  subscribers: [],
  settings: {
    name: String(envMeta.VITE_STORE_NAME || "Valerie & CO").slice(0, 24),
    email: envMeta.VITE_SUPPORT_EMAIL || "concierge@valerieco.atelier",
    announcement: {
      en:
        envMeta.VITE_ANNOUNCEMENT_EN ||
        "A new perspective on everyday luxury.",
      id:
        envMeta.VITE_ANNOUNCEMENT_ID ||
        "Sudut pandang baru untuk kemewahan sehari-hari.",
    },
  },
};
const KEY = "valerieco.studio.v7";
function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function load(): Database {
  let d = read<Database | null>(KEY, null);
  if (!d) {
    const prev =
      read<Database | null>("solere.studio.v6", null) ||
      read<Database | null>("solere.studio.v5", null);
    if (prev) {
      d = { ...prev, products: initialCatalog };
    }
  }
  try {
    localStorage.removeItem("solere.studio.v6");
    localStorage.removeItem("solere.studio.v5");
    localStorage.removeItem("solere.studio.v3");
    localStorage.removeItem("solere.studio.v2");
    localStorage.removeItem("solere.studio.v1");
    localStorage.removeItem("solere.store.v1");
  } catch {}
  if (!d) d = initial;
  const isClean =
    d &&
    Array.isArray(d.products) &&
    d.products.length > 0 &&
    d.products.every(
      (p) =>
        (p.id.startsWith("solere-") ||
          p.id.startsWith("vco-") ||
          /^[0-9a-f-]{8,}$/i.test(p.id)) &&
        !/gucci|balenciaga|prada|nike|palm|eytys|margiela|bottega|rick|saint/i.test(
          p.brand + p.name,
        ),
    ) &&
    Array.isArray(d.bag) &&
    Array.isArray(d.orders) &&
    Array.isArray(d.members) &&
    Array.isArray(d.favorites) &&
    Array.isArray(d.coupons) &&
    Array.isArray(d.tickets) &&
    d.settings;
  if (!isClean) return initial;
  const normalizedName =
    d.settings?.name && d.settings.name.trim().toUpperCase() !== "SOLÈRE"
      ? d.settings.name
      : "Valerie & CO";
  return {
    ...d,
    products: d.products.map((p) => ({
      ...p,
      brand: p.brand === "SOLÈRE" ? "Valerie & CO" : p.brand,
      details:
        p.details?.origin?.includes("SOLÈRE")
          ? {
              ...p.details,
              origin: p.details.origin.replace(/SOLÈRE/g, "Valerie & CO"),
            }
          : p.details,
    })),
    settings: { ...d.settings, name: normalizedName },
  };
}
function useStoreState() {
  const [db, setDbLocal] = useState<Database>(() =>
    serverMode
      ? {
          ...initial,
          bag: read("solere.server.bag", []),
          favorites: read("solere.server.favorites", []),
        }
      : load(),
  );
  const dbRef = useRef(db);
  const [backendUser, setBackendUser] = useState<{
    id: string;
    role: string;
  } | null>(null);
  const [needsAdmin, setNeedsAdmin] = useState(false);
  const [ready, setReady] = useState(!serverMode);
  const [backendError, setBackendError] = useState("");
  const [pending, setPending] = useState(false);
  const queue = useRef(Promise.resolve());
  const defaultLang = envMeta.VITE_DEFAULT_LANG === "en" ? "en" : "id";
  const [lang, setLang] = useState<Lang>(() =>
    read<string>("solere.lang", defaultLang) === "en" ? "en" : "id",
  );
  const [theme, setTheme] = useState<"espresso">("espresso");
  const [memberId, setMemberId] = useState<string | null>(() =>
    read("solere.member", null),
  );
  const [toast, setToast] = useState("");
  const [storageError, setStorageError] = useState(false);
  const write = (next: Database) => {
    dbRef.current = next;
    setDbLocal(next);
  };
  const receive = (data: any) => {
    const local = dbRef.current;
    const incomingSettings = data.settings
      ? {
          ...data.settings,
          name:
            !data.settings.name ||
            /^SOL[EÈ]RE$/i.test(String(data.settings.name).trim())
              ? initial.settings.name
              : data.settings.name,
          email:
            !data.settings.email ||
            String(data.settings.email).trim().toLowerCase() ===
              "care@solere.example"
              ? initial.settings.email
              : data.settings.email,
        }
      : local.settings;
    write({
      ...local,
      ...data,
      settings: incomingSettings,
      bag: local.bag,
      favorites: local.favorites,
    });
    setBackendUser(data.currentUser);
    setMemberId(data.currentUser?.id || null);
    setNeedsAdmin(!!data.needsAdmin);
    setBackendError("");
  };
  const refresh = async () => {
    try {
      receive(await api("state"));
      setReady(true);
    } catch (e) {
      setBackendError((e as Error).message);
    }
  };
  useEffect(() => {
    if (serverMode) void refresh();
  }, []);
  const setDb = (action: SetStateAction<Database>) => {
    const old = dbRef.current;
    const next = typeof action === "function" ? action(old) : action;
    write(next);
    if (!serverMode) return;
    const changes: { kind: string; data: unknown }[] = [];
    for (const kind of ["products", "members", "coupons", "tickets"] as const) {
      for (const value of next[kind]) {
        const id = "code" in value ? value.code : value.id;
        const before = (old[kind] as any[]).find(
          (v) => (v.code || v.id) === id,
        );
        if (JSON.stringify(before) !== JSON.stringify(value))
          changes.push({ kind, data: value });
      }
    }
    for (const kind of ["products", "coupons"] as const) {
      for (const oldVal of old[kind] as any[]) {
        const id = "code" in oldVal ? oldVal.code : oldVal.id;
        const stillExists = (next[kind] as any[]).some(
          (v) => (v.code || v.id) === id,
        );
        if (!stillExists) {
          changes.push({ kind: `${kind}_delete`, data: { id } });
        }
      }
    }
    if (JSON.stringify(old.settings) !== JSON.stringify(next.settings))
      changes.push({ kind: "settings", data: next.settings });
    for (const email of next.subscribers)
      if (!old.subscribers.includes(email))
        changes.push({ kind: "subscribers", data: { email } });
    if (changes.length) {
      setPending(true);
      queue.current = queue.current.then(async () => {
        try {
          receive(await api("patch", { changes }));
        } catch (e) {
          setToast((e as Error).message);
          await refresh();
        } finally {
          setPending(false);
        }
      });
    }
  };
  useEffect(() => {
    try {
      if (serverMode) {
        localStorage.setItem("solere.server.bag", JSON.stringify(db.bag));
        localStorage.setItem(
          "solere.server.favorites",
          JSON.stringify(db.favorites),
        );
      } else localStorage.setItem(KEY, JSON.stringify(db));
    } catch {
      setStorageError(true);
    }
  }, [db]);
  useEffect(() => {
    document.documentElement.lang = lang;
    try {
      localStorage.setItem("solere.lang", JSON.stringify(lang));
    } catch {}
  }, [lang]);
  useEffect(() => {
    document.documentElement.dataset.theme = "espresso";
    try {
      localStorage.removeItem("solere.theme");
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("solere.member", JSON.stringify(memberId));
    } catch {}
  }, [memberId]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(t);
  }, [toast]);
  const t = (id: string, en: string) => (lang === "id" ? id : en);
  const currency: Currency = lang === "id" ? "IDR" : "USD";
  const money = (n: number, targetCurrency: Currency = currency) =>
    new Intl.NumberFormat(lang === "id" ? "id-ID" : "en-US", {
      style: "currency",
      currency: targetCurrency,
      maximumFractionDigits: targetCurrency === "IDR" ? 0 : 2,
    }).format(n);
  const priceText = (item: Pick<Item, "price" | "priceIdr">, quantity = 1) =>
    money(itemPrice(item, currency) * quantity, currency);
  const member = db.members.find((m) => m.id === memberId) || null;
  const notify = (id: string, en: string) => setToast(t(id, en));
  const deleteProduct = (id: string) => {
    setDb((d) => ({
      ...d,
      products: d.products.filter((p) => p.id !== id),
      bag: d.bag.filter((l) => l.productId !== id),
      favorites: d.favorites.filter((fid) => fid !== id),
      settings: d.settings.homepage
        ? {
            ...d.settings,
            homepage: {
              ...d.settings.homepage,
              productIds: d.settings.homepage.productIds.filter((pid) => pid !== id),
            },
          }
        : d.settings,
    }));
    notify("Produk dihapus dari katalog", "Product deleted from catalogue");
  };
  const deleteCoupon = (code: string) => {
    setDb((d) => ({
      ...d,
      coupons: d.coupons.filter((c) => c.code !== code),
    }));
    notify("Kode promo dihapus", "Promotion code deleted");
  };
  const resetCatalogToExamples = () => {
    setDb((d) => ({
      ...d,
      products: initialCatalog,
    }));
    notify(
      "Katalog koleksi berhasil disinkronkan",
      "Collection catalogue synchronized",
    );
  };
  const clearAllProducts = () => {
    setDb((d) => ({
      ...d,
      products: [],
      bag: [],
      favorites: [],
      settings: d.settings.homepage
        ? {
            ...d.settings,
            homepage: { ...d.settings.homepage, productIds: [] },
          }
        : d.settings,
    }));
    notify("Semua produk katalog dikosongkan", "All catalogue products cleared");
  };
  const favorite = (id: string) =>
    setDb((d) => ({
      ...d,
      favorites: d.favorites.includes(id)
        ? d.favorites.filter((x) => x !== id)
        : [...d.favorites, id],
    }));
  const add = (line: BagLine) => {
    const p = db.products.find((p) => p.id === line.productId);
    if (!p?.active) return false;
    try {
      const bag = addLine(db.bag, line, p.stock);
      setDb((d) => ({ ...d, bag }));
      notify("Ditambahkan ke tas belanja", "Added to your shopping bag");
      return true;
    } catch {
      notify(
        "Jumlah melebihi stok tersedia",
        "Quantity exceeds available stock",
      );
      return false;
    }
  };
  const normalizeWaPhone = (raw = "") => {
    const digits = raw.replace(/[^\d+]/g, "");
    if (!digits) return "";
    if (digits.startsWith("08")) return `+62${digits.slice(1)}`;
    if (digits.startsWith("62")) return `+${digits}`;
    if (digits.startsWith("+")) return digits;
    return `+${digits}`;
  };
  const enter = (name: string, email: string, phone = "") => {
    const normalized = email.trim().toLowerCase();
    const normalizedPhone = normalizeWaPhone(phone);
    const exists = db.members.find(
      (m) =>
        (normalized && m.email === normalized) ||
        (normalizedPhone && normalizeWaPhone(m.phone) === normalizedPhone),
    );
    if (exists) {
      if (normalizedPhone && !exists.phone) {
        setDb((d) => ({
          ...d,
          members: d.members.map((m) =>
            m.id === exists.id
              ? { ...m, phone: normalizedPhone, phoneVerified: false }
              : m,
          ),
        }));
      }
      setMemberId(exists.id);
      return;
    }
    const fallbackEmail = normalizedPhone
      ? `wa.${normalizedPhone.replace(/\D/g, "")}@member.solere.id`
      : "member@solere.id";
    const m: Member = {
      id: crypto.randomUUID(),
      name: name.trim(),
      email: normalized || fallbackEmail,
      phone: normalizedPhone,
      emailVerified: false,
      phoneVerified: false,
      addresses: [],
    };
    setDb((d) => ({ ...d, members: [...d.members, m] }));
    setMemberId(m.id);
  };
  const saveMember = (value: Member) => {
    const normalizedPhone = value.phone ? normalizeWaPhone(value.phone) : "";
    setDb((d) => ({
      ...d,
      members: d.members.map((m) => {
        if (m.id !== value.id) return m;
        const phoneChanged =
          normalizeWaPhone(m.phone) !== normalizeWaPhone(normalizedPhone);
        return {
          ...value,
          phone: normalizedPhone,
          phoneVerified: phoneChanged ? false : value.phoneVerified,
        };
      }),
    }));
    notify("Perubahan tersimpan", "Changes saved");
  };
  const checkout = async (
    address: Address,
    code: string,
    express: boolean,
    key = crypto.randomUUID(),
    expectedTotal?: number,
  ) => {
    if (serverMode) {
      const result = await api("orders/create", {
        address,
        code,
        express,
        lines: dbRef.current.bag,
        key,
        ...(dbRef.current.paymentConfig?.enabled
          ? { payment: "midtrans", expectedTotal }
          : { currency }),
      });
      receive(result.state);
      write({ ...dbRef.current, bag: [] });
      return result.order as Order;
    }
    if (!member || !validateBag(db.bag, db.products))
      throw new Error("Invalid cart");
    const coupon = db.coupons.find((c) => c.active && c.code === code);
    const sum = totals(db.bag, db.products, coupon, express, currency);
    const orderId = `SOL-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const order: Order = {
      id: orderId,
      receiptNumber: `VCO-INV-${orderId.replace(/^SOL-/, "")}`,
      memberId: member.id,
      name: member.name,
      email: member.email,
      date: new Date().toISOString(),
      status: "processing",
      paymentMethod: "direct",
      currency,
      items: db.bag.map((l) => {
        const p = db.products.find((x) => x.id === l.productId)!;
        return {
          ...l,
          productCode: p.details?.code || p.id.toUpperCase(),
          name: p.name,
          image: p.images[0],
          price: itemPrice(p, currency),
        };
      }),
      ...sum,
      address,
      tracking: "",
    };
    setDb((d) => ({
      ...d,
      orders: [order, ...d.orders],
      bag: [],
      products: d.products.map((p) => ({
        ...p,
        stock:
          p.stock -
          db.bag
            .filter((l) => l.productId === p.id)
            .reduce((s, l) => s + l.quantity, 0),
      })),
    }));
    return order;
  };
  const updateOrder = (
    id: string,
    status: Order["status"],
    tracking?: string,
  ) => {
    if (serverMode) {
      void api("orders/update", { id, status, tracking })
        .then(receive)
        .catch((e) => setToast(e.message));
      return;
    }
    setDb((d) => {
      const old = d.orders.find((o) => o.id === id);
      if (!old) return d;
      if (old.status === "cancelled" || old.status === "delivered") return d;
      const allowed: Record<Order["status"], Order["status"][]> = {
        processing: ["processing", "shipped", "cancelled"],
        shipped: ["shipped", "delivered"],
        delivered: [],
        cancelled: [],
      };
      if (!allowed[old.status].includes(status)) return d;
      return {
        ...d,
        orders: d.orders.map((o) =>
          o.id === id ? { ...o, status, tracking: tracking ?? o.tracking } : o,
        ),
        products:
          status === "cancelled"
            ? d.products.map((p) => ({
                ...p,
                stock:
                  p.stock +
                  old.items
                    .filter((i) => i.productId === p.id)
                    .reduce((s, i) => s + i.quantity, 0),
              }))
            : d.products,
      };
    });
  };
  const refundOrder = async (
    id: string,
    reason: string,
    options?: {
      action?: "request" | "approve" | "reject";
      manual?: boolean;
      reference?: string;
    },
  ) => {
    const cleanReason = reason.trim() || "Permintaan refund / Refund request";
    const action =
      options?.action || (backendUser?.role === "admin" ? "approve" : "request");
    if (serverMode) {
      receive(
        await api("orders/refund", {
          id,
          reason: cleanReason,
          action,
          manual: options?.manual,
          reference: options?.reference,
        }),
      );
      notify(
        action === "approve"
          ? "Refund berhasil diproses & stok dipulihkan"
          : action === "reject"
            ? "Pengajuan refund ditolak"
            : "Pengajuan refund berhasil dikirim",
        action === "approve"
          ? "Refund processed & stock restored"
          : action === "reject"
            ? "Refund request declined"
            : "Refund request submitted",
      );
      return;
    }
    const now = new Date().toISOString();
    setDb((d) => {
      const old = d.orders.find((o) => o.id === id);
      if (!old) return d;
      if (action === "request") {
        if (old.status === "cancelled" || old.refund?.status === "refunded")
          return d;
        return {
          ...d,
          orders: d.orders.map((o) =>
            o.id === id
              ? {
                  ...o,
                  refund: {
                    status: "requested",
                    amount: o.total,
                    currency: o.currency || "USD",
                    reason: cleanReason,
                    requestedAt: now,
                  },
                }
              : o,
          ),
        };
      }
      if (action === "reject") {
        if (!old.refund || old.refund.status !== "requested") return d;
        return {
          ...d,
          orders: d.orders.map((o) =>
            o.id === id
              ? {
                  ...o,
                  refund: {
                    ...o.refund!,
                    status: "rejected",
                    note: cleanReason,
                    refundedBy: member?.email || "admin",
                  },
                }
              : o,
          ),
        };
      }
      if (old.refund?.status === "refunded" || old.payment?.status === "refunded")
        return d;
      const shouldRestore =
        old.status !== "cancelled" && old.payment?.status !== "failed";
      const refundRef =
        options?.reference?.trim() ||
        `VCO-REF-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
      return {
        ...d,
        orders: d.orders.map((o) =>
          o.id === id
            ? {
                ...o,
                status: "cancelled",
                ...(o.payment
                  ? {
                      payment: {
                        ...o.payment,
                        status: "refunded",
                        refundedAt: now,
                        updatedAt: now,
                      },
                    }
                  : {}),
                refund: {
                  ...(o.refund || {}),
                  status: "refunded",
                  amount: o.total,
                  currency: o.currency || "USD",
                  reason: o.refund?.reason || cleanReason,
                  note: cleanReason,
                  requestedAt: o.refund?.requestedAt || now,
                  refundedAt: now,
                  refundedBy: member?.email || "admin",
                  reference: refundRef,
                },
              }
            : o,
        ),
        products: shouldRestore
          ? d.products.map((p) => ({
              ...p,
              stock:
                p.stock +
                old.items
                  .filter((i) => i.productId === p.id)
                  .reduce((s, i) => s + i.quantity, 0),
            }))
          : d.products,
      };
    });
    notify(
      action === "approve"
        ? "Refund berhasil diproses & stok dipulihkan"
        : action === "reject"
          ? "Pengajuan refund ditolak"
          : "Pengajuan refund berhasil dikirim",
      action === "approve"
        ? "Refund processed & stock restored"
        : action === "reject"
          ? "Refund request declined"
          : "Refund request submitted",
    );
  };
  const authenticate = async (
    mode: "login" | "register" | "setup",
    data: {
      name?: string;
      email: string;
      phone?: string;
      password: string;
      setupToken?: string;
    },
  ) => {
    receive(await api(`auth/${mode}`, data));
  };
  const requestVerification = async (channel: "email" | "phone") => {
    return api("member/verify/request", { channel });
  };
  const confirmVerification = async (
    channel: "email" | "phone",
    code: string,
  ) => {
    receive(await api("member/verify/confirm", { channel, code }));
  };
  const logout = async () => {
    if (serverMode) receive(await api("auth/logout", {}));
    else setMemberId(null);
  };
  const applyCoupon = async (code: string) => {
    if (serverMode) {
      const coupon = await api("coupon", { code });
      write({
        ...dbRef.current,
        coupons: [
          ...dbRef.current.coupons.filter((c) => c.code !== coupon.code),
          coupon,
        ],
      });
      return coupon as Coupon;
    }
    const coupon = db.coupons.find(
      (c) => c.active && c.code === code.trim().toUpperCase(),
    );
    if (!coupon)
      throw Error(
        t("Kode tidak valid atau tidak aktif", "Code is invalid or inactive"),
      );
    return coupon;
  };
  return {
    serverMode,
    ready,
    backendError,
    refresh,
    backendUser,
    needsAdmin,
    pending,
    authenticate,
    requestVerification,
    confirmVerification,
    logout,
    applyCoupon,
    db,
    setDb,
    lang,
    setLang,
    theme,
    setTheme,
    t,
    currency,
    money,
    priceText,
    member,
    setMemberId,
    toast,
    notify,
    storageError,
    favorite,
    add,
    enter,
    saveMember,
    checkout,
    updateOrder,
    refundOrder,
    deleteProduct,
    deleteCoupon,
    resetCatalogToExamples,
    clearAllProducts,
  };
}
const Context = createContext<ReturnType<typeof useStoreState> | null>(null);
export function StoreProvider({ children }: { children: ReactNode }) {
  const store = useStoreState();
  return <Context.Provider value={store}>{children}</Context.Provider>;
}
export function useStore() {
  const store = useContext(Context);
  if (!store) throw Error("Missing store");
  return store;
}

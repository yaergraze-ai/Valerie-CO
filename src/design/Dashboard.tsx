import { defaultShowcaseImages } from "./showcase-data";
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  Users,
  Tag,
  Settings,
  MessageSquare,
  MapPin,
  User,
  Heart,
  ArrowUpRight,
  Plus,
  Minus,
  Download,
  Search,
  Pencil,
  Trash2,
  Check,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Clock,
  Truck,
  ArrowRight,
  BarChart3,
  Mail,
  CheckCircle2,
  Upload,
  Columns3,
  LayoutGrid,
  Sparkles,
  Shield,
  ShieldCheck,
  KeyRound,
  Eye,
  EyeOff,
  Camera,
  Lock,
  Smartphone,
  Globe,
  Bell,
  Printer,
  RotateCcw,
  Receipt,
  UserCheck,
  UserCog,
  Crown,
} from "lucide-react";
import {
  useStore,
  nextProductCode,
  buildProductId,
  isStudioRole,
  isAdminRole,
  isSuperAdminRole,
  type UserRole,
  type Member,
  type Order,
  type Address,
  type Ticket,
} from "./store";
import type { Item } from "./catalog";
import { Modal, Empty, Status, csvDownload } from "./ui";
import {
  AddressFields,
  InlinePaymentAndReceipt,
  MemberEntry,
} from "./Shopping";
import { api } from "./backend";
import { ProductCard } from "./Experience";
import {
  CutoutImg,
  removeBackgroundFromImageElement,
} from "./bg-remove";
type Props = {
  mode: "member" | "admin";
  onShop: () => void;
  onWishlist: () => void;
  onEntry: () => void;
  onSelect: (p: Item) => void;
};

type RoleSpec = {
  role: UserRole;
  labelId: string;
  labelEn: string;
  scopeId: string;
  scopeEn: string;
  perksId: string[];
  perksEn: string[];
};

const ROLE_SPECS: RoleSpec[] = [
  {
    role: "super_admin",
    labelId: "Super Admin",
    labelEn: "Super Admin",
    scopeId: "Otoritas penuh atas arsitektur tim, keuangan, katalog, & toko.",
    scopeEn: "Full authority across team roles, refunds, catalogue, & store.",
    perksId: [
      "Kelola peran Admin, Staff, & Member",
      "Setujui atau tolak refund pembayaran",
      "Atur katalog, promo kupon, & identitas toko",
    ],
    perksEn: [
      "Manage Admin, Staff, & Member roles",
      "Approve or reject order refunds",
      "Manage catalogue, coupons, & store identity",
    ],
  },
  {
    role: "admin",
    labelId: "Admin",
    labelEn: "Admin",
    scopeId: "Kendali operasional katalog, promo, refund, & anggota Staff.",
    scopeEn: "Operational control of catalogue, promos, refunds, & Staff.",
    perksId: [
      "Tambah, edit, arsip, & hapus produk",
      "Kelola kupon promo & proses refund",
      "Tetapkan peran Staff / Member",
    ],
    perksEn: [
      "Create, edit, archive, & remove products",
      "Manage promo coupons & order refunds",
      "Assign Staff / Member roles",
    ],
  },
  {
    role: "staff",
    labelId: "Staff",
    labelEn: "Staff",
    scopeId: "Fokus fulfillment pesanan, pembaruan stok, & layanan pelanggan.",
    scopeEn: "Focused on order fulfilment, stock updates, & client concierge.",
    perksId: [
      "Proses status pesanan & input nomor resi",
      "Perbarui stok produk (proteksi harga/hapus)",
      "Balas & selesaikan pesan pelanggan",
    ],
    perksEn: [
      "Update order fulfilment & tracking numbers",
      "Adjust unit stock (catalog metadata protected)",
      "Reply & close client concierge tickets",
    ],
  },
  {
    role: "member",
    labelId: "Member",
    labelEn: "Member",
    scopeId: "Ruang pribadi belanja, profil ukuran EU, alamat, & keamanan akun.",
    scopeEn: "Personal space for orders, EU fit profile, addresses, & security.",
    perksId: [
      "Lacak pesanan & unduh struk resmi",
      "Ajukan refund & simpan wishlist",
      "Verifikasi OTP Email / WA & pengaturan 2FA",
    ],
    perksEn: [
      "Track orders & download official receipts",
      "Request refunds & curate saved wishlist",
      "Email / WhatsApp OTP & 2FA account protection",
    ],
  },
];

function formatRoleLabel(role: string | undefined, t: (id: string, en: string) => string) {
  const spec = ROLE_SPECS.find((r) => r.role === role) || ROLE_SPECS[3];
  return t(spec.labelId, spec.labelEn);
}

function RoleBadge({
  role,
  t,
}: {
  role?: string;
  t: (id: string, en: string) => string;
}) {
  const normalized: UserRole =
    role === "super_admin" || role === "admin" || role === "staff"
      ? role
      : "member";
  const Icon =
    normalized === "super_admin"
      ? Crown
      : normalized === "admin"
        ? ShieldCheck
        : normalized === "staff"
          ? UserCheck
          : User;
  return (
    <span className={`role-badge role-${normalized}`}>
      <Icon size={12} aria-hidden="true" />
      <span>{formatRoleLabel(normalized, t)}</span>
    </span>
  );
}

export default function Dashboard({
  mode,
  onShop,
  onWishlist,
  onEntry: _onEntry,
  onSelect,
}: Props) {
  const {
    db,
    t,
    currency,
    money,
    priceText,
    member,
    lang,
    setLang,
    saveMember,
    serverMode,
    backendUser,
    studioRole,
    setStudioRolePreview,
    updateMemberRole,
    claimStudioAccess,
    logout,
  } = useStore();
  const [tab, setTab] = useState("overview");
  const [order, setOrder] = useState<string | null>(null);
  const [chartTab, setChartTab] = useState<
    "profit" | "category" | "stock" | "orders"
  >("profit");
  const [selectedChartKey, setSelectedChartKey] = useState<string | null>(null);
  const admin = mode === "admin";
  const activeStudioRole: UserRole = admin
    ? isStudioRole(studioRole)
      ? studioRole
      : "super_admin"
    : "member";
  const canManageCatalog = !admin || isAdminRole(activeStudioRole);
  const hasSuperAdmin = db.members.some((m) => m.role === "super_admin");
  const canSwitchPreview =
    admin && (!serverMode || isAdminRole(backendUser?.role));
  const adminTabs = (
    [
      ["overview", t("Ringkasan", "Overview"), LayoutDashboard],
      ["orders", t("Pesanan", "Orders"), ShoppingBag],
      ["products", t("Produk", "Products"), Package],
      ["customers", t("Pelanggan", "Clients"), Users],
      ...(isAdminRole(activeStudioRole)
        ? ([
            ["coupons", t("Promo", "Promotions"), Tag],
            ["team", t("Tim & Akses", "Team & Access"), ShieldCheck],
          ] as const)
        : []),
      ["support", t("Pesan", "Messages"), MessageSquare],
      ...(isAdminRole(activeStudioRole)
        ? ([["settings", t("Pengaturan", "Settings"), Settings]] as const)
        : []),
    ] as const
  );
  const memberTabs = [
    ["overview", t("Ringkasan", "Overview"), LayoutDashboard],
    ["orders", t("Pesanan", "Orders"), ShoppingBag],
    ["addresses", t("Alamat", "Addresses"), MapPin],
    ["profile", t("Profil", "Profile"), User],
    ["settings", t("Keamanan", "Security"), Shield],
    ["support", t("Bantuan", "Support"), MessageSquare],
  ] as const;
  const tabs = admin ? adminTabs : memberTabs;
  const activeTab = tabs.some((x) => x[0] === tab) ? tab : "overview";
  const orders = admin
    ? db.orders
    : db.orders.filter((o) => o.memberId === member?.id);
  const title = tabs.find((x) => x[0] === activeTab)?.[1];
  if (admin && serverMode && !isStudioRole(backendUser?.role))
    return (
      <section className="member-landing section">
        <div className={`member-intro ${member ? "member-intro-action" : ""}`}>
          <span className="eyebrow">VALERIE & CO STUDIO</span>
          <h1>
            {t("Ruang khusus\nuntuk tim Anda.", "A workspace\nfor your team.")}
          </h1>
          <p>
            {t(
              "Pengelolaan studio memerlukan akun dengan hak akses Staff, Admin, atau Super Admin.",
              "Studio management requires an account with Staff, Admin, or Super Admin permissions.",
            )}
          </p>
          {member && (
            <StudioClaimBox
              memberName={member.name}
              memberEmail={member.email}
              onClaim={claimStudioAccess}
              onLogout={() => void logout()}
              t={t}
            />
          )}
        </div>
        <MemberEntry admin onDone={() => setTab("overview")} />
      </section>
    );
  if (!admin && !member)
    return (
      <section className="member-landing section">
        <div className="member-intro">
          <span className="eyebrow">VALERIE & CO MEMBERS</span>
          <h1>
            {t(
              "Ruang pribadi\nuntuk gaya Anda.",
              "A personal space\nfor your own style.",
            )}
          </h1>
          <p>
            {t(
              "Pesanan, koleksi favorit, dan setiap detail kecil. Semua di satu tempat.",
              "Your orders, your favourites, and all the little details. Together in one place.",
            )}
          </p>
          <div className="member-illustration">
            <CutoutImg
              src="/shoes/02_Boots/03_zavira_espresso_ankle/03_zavira_espresso_ankle.webp"
              alt="Valerie & CO Zavira Espresso Ankle Boot"
            />
            <span>YOUR NEXT CHAPTER</span>
          </div>
        </div>
        <MemberEntry onDone={() => setTab("overview")} />
      </section>
    );
  return (
    <section
      className={`dashboard ${admin ? "admin-dashboard" : "member-dashboard"}`}
      data-active-tab={activeTab}
    >
      <aside className="dashboard-sidebar">
        <div className="workspace-label">
          <span className="workspace-symbol">V.</span>
          <div>
            <b>{admin ? "VALERIE & CO STUDIO" : "VALERIE & CO MEMBERS"}</b>
            <small>
              {admin
                ? `${formatRoleLabel(activeStudioRole, t)} · ${t("Ruang Studio", "Studio Workspace")}`
                : t("Ruang pribadi Anda", "Your personal space")}
            </small>
          </div>
        </div>
        <span className="eyebrow side-label">
          {t("RUANG KERJA", "WORKSPACE")}
        </span>
        <nav aria-label={t("Navigasi dashboard", "Dashboard navigation")}>
          {tabs.map(([id, label, Icon]) => (
            <button
              key={id}
              className={activeTab === id ? "active" : ""}
              aria-current={activeTab === id ? "page" : undefined}
              onClick={() => setTab(id)}
            >
              {activeTab === id && (
                <motion.span
                  layoutId="sidebar-active-pill"
                  className="sidebar-glass-pill"
                  transition={{
                    type: "spring",
                    stiffness: 460,
                    damping: 34,
                    mass: 0.72,
                  }}
                />
              )}
              <Icon size={18} aria-hidden="true" />
              <span>{label}</span>
              {id === "orders" && orders.length > 0 && <b>{orders.length}</b>}
              {id === "support" &&
                db.tickets.filter(
                  (x) =>
                    x.status === "open" && (admin || x.memberId === member?.id),
                ).length > 0 && <i />}
            </button>
          ))}
          {!admin && (
            <button onClick={onWishlist}>
              <Heart size={18} />
              <span>{t("Favorit saya", "My wishlist")}</span>
              <b>{db.favorites.length}</b>
            </button>
          )}
        </nav>
        <div className="sidebar-bottom">
          <button className="text-link" onClick={() => void logout()}>
            <LogOut size={15} />
            {t("Keluar akun", "Sign out")}
          </button>
        </div>
      </aside>
      <div className="dashboard-content">
        <header className="dashboard-top">
          <div>
            <div className="dashboard-eyebrow-row">
              <span className="eyebrow">
                {admin ? "VALERIE & CO / STUDIO" : "VALERIE & CO / MEMBERS"}
              </span>
              <RoleBadge
                role={admin ? activeStudioRole : member?.role || "member"}
                t={t}
              />
            </div>
            <h1>{title}</h1>
          </div>
          <div className="dashboard-person">
            <RealtimeClockCalendar
              orders={orders}
              lang={lang}
              t={t}
              money={money}
              onSelectOrder={(id) => setOrder(id)}
            />
            {member?.avatar ? (
              <img
                src={member.avatar}
                alt={member.name}
                className="avatar avatar-photo"
              />
            ) : (
              <span className="avatar">
                {member?.name
                  ? member.name.slice(0, 1).toUpperCase()
                  : admin
                    ? "V"
                    : "M"}
              </span>
            )}
            {(!admin || serverMode) && (
              <button
                type="button"
                className="top-logout-btn"
                title={t("Keluar akun", "Sign out")}
                aria-label={t("Keluar akun", "Sign out")}
                onClick={() => void logout()}
              >
                <LogOut size={15} />
              </button>
            )}
          </div>
        </header>
        {canSwitchPreview && (
          <div className="studio-role-bar" role="region" aria-label={t("Mode tampilan peran studio", "Studio role perspective")}>
            <div className="studio-role-copy">
              <UserCog size={14} aria-hidden="true" />
              <span>
                {t(
                  "Perspektif Ruang Kerja Studio:",
                  "Studio Role Perspective:",
                )}
              </span>
            </div>
            <div className="studio-role-pills" role="group">
              {(["super_admin", "admin", "staff"] as const).map((roleKey) => {
                const isSelected = activeStudioRole === roleKey;
                const lockedSuper =
                  serverMode &&
                  roleKey === "super_admin" &&
                  !isSuperAdminRole(backendUser?.role) &&
                  hasSuperAdmin;
                return (
                  <button
                    key={roleKey}
                    type="button"
                    disabled={lockedSuper}
                    className={isSelected ? "active" : ""}
                    onClick={() => {
                      if (
                        serverMode &&
                        roleKey === "super_admin" &&
                        !isSuperAdminRole(backendUser?.role) &&
                        !hasSuperAdmin &&
                        backendUser?.id
                      ) {
                        setStudioRolePreview(null);
                        void updateMemberRole(backendUser.id, "super_admin");
                        return;
                      }
                      setStudioRolePreview(
                        backendUser?.role === roleKey ? null : roleKey,
                      );
                    }}
                  >
                    {formatRoleLabel(roleKey, t)}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            className="dashboard-tab-stage"
            initial={{ opacity: 0, y: 12, scale: 0.992, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -8, scale: 0.994, filter: "blur(4px)" }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
        {activeTab === "overview" && (
          <>
            <motion.div
              className="dashboard-welcome"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
            >
              <div>
                <span className="eyebrow">
                  {admin
                    ? `VALERIE & CO · ${formatRoleLabel(activeStudioRole, t).toUpperCase()}`
                    : "PRESTIGE MEMBER"}
                </span>
                <h2>
                  {admin
                    ? isSuperAdminRole(activeStudioRole)
                      ? t("Komando utama atelier.", "Atelier master command.")
                      : activeStudioRole === "staff"
                        ? t("Pusat operasional harian.", "Daily fulfilment desk.")
                        : t("Pusat kendali toko.", "Store command center.")
                    : t(
                        `Halo, ${member?.name.split(" ")[0]}.`,
                        `Hello, ${member?.name.split(" ")[0]}.`,
                      )}
                </h2>
                <p>
                  {admin
                    ? activeStudioRole === "staff"
                      ? t(
                          `${orders.filter((o) => o.status === "processing").length} pesanan menunggu proses · ${db.tickets.filter((x) => x.status === "open").length} pesan concierge terbuka.`,
                          `${orders.filter((o) => o.status === "processing").length} orders awaiting fulfilment · ${db.tickets.filter((x) => x.status === "open").length} open concierge tickets.`,
                        )
                      : t(
                          `${db.products.filter((p) => p.active).length} model aktif · ${orders.filter((o) => o.status === "processing").length} pesanan menunggu proses.`,
                          `${db.products.filter((p) => p.active).length} active pieces · ${orders.filter((o) => o.status === "processing").length} orders awaiting fulfilment.`,
                        )
                    : member?.emailVerified && member?.phoneVerified
                      ? t(
                          "Email & WhatsApp terverifikasi · Siap menikmati akses privat Valerie & CO.",
                          "Email & WhatsApp verified · Full Valerie & CO private access active.",
                        )
                      : t(
                          "Lengkapi verifikasi email dan WhatsApp untuk keamanan & pembaruan pesanan instan.",
                          "Verify your email and WhatsApp for stronger security & instant order updates.",
                        )}
                </p>
                <div className="welcome-cta-row">
                  {admin ? (
                    <>
                      {canManageCatalog ? (
                        <button
                          type="button"
                          className="button light small"
                          onClick={() => setTab("products")}
                        >
                          <Plus size={14} />
                          {t("Kelola Produk", "Manage Catalogue")}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="button light small"
                          onClick={() => setTab("orders")}
                        >
                          <ShoppingBag size={14} />
                          {t("Proses Pesanan", "Fulfil Orders")}
                        </button>
                      )}
                      {isAdminRole(activeStudioRole) ? (
                        <button
                          type="button"
                          className="button ghost small"
                          onClick={() => setTab("team")}
                        >
                          <ShieldCheck size={14} />
                          {t("Tim & Hak Akses", "Team & Access")}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="button ghost small"
                          onClick={() => setTab("products")}
                        >
                          {t("Perbarui Stok", "Update Stock")}
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="button light small"
                        onClick={onShop}
                      >
                        {t("Jelajahi Koleksi", "Browse Collection")}
                        <ArrowUpRight size={14} />
                      </button>
                      {(!member?.emailVerified || !member?.phoneVerified) && (
                        <button
                          type="button"
                          className="button ghost small"
                          onClick={() => setTab("profile")}
                        >
                          {t("Verifikasi Kontak", "Verify Contacts")}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
              <div className="welcome-art">
                <CutoutImg
                  src={
                    admin
                      ? "/shoes/01_Sneakers/01_velora_blush_chunky/01_velora_blush_chunky.webp"
                      : "/shoes/02_Boots/03_zavira_espresso_ankle/03_zavira_espresso_ankle.webp"
                  }
                  alt=""
                />
              </div>
            </motion.div>
            <div className="metric-grid">
              {(() => {
                const studioGross = db.products.reduce((sum, p) => {
                  const unit =
                    currency === "IDR"
                      ? (p.priceIdr ?? p.price * 16000)
                      : p.price;
                  const orderedQty = orders
                    .filter((o) => o.status !== "cancelled")
                    .reduce(
                      (s, o) =>
                        s +
                        o.items
                          .filter((i) => i.productId === p.id)
                          .reduce((q, i) => q + i.quantity, 0),
                      0,
                    );
                  const baseQty = Math.max(
                    2,
                    Math.round((40 - Math.min(34, p.stock)) / 4),
                  );
                  return sum + unit * (orderedQty + baseQty);
                }, 0);
                const studioNetProfit = Math.round(studioGross * 0.42);
                const cards = admin
                  ? activeStudioRole === "staff"
                    ? [
                        {
                          label: t(
                            "Estimasi laba bersih (42%)",
                            "Estimated net profit (42%)",
                          ),
                          value: money(studioNetProfit),
                          note: t(
                            `Omzet kotor ${money(studioGross)} · Klik untuk rincian grafik`,
                            `Gross ${money(studioGross)} · Click for chart breakdown`,
                          ),
                          Icon: BarChart3,
                          targetTab: "profit_chart",
                        },
                        {
                          label: t("Menunggu proses", "Awaiting fulfilment"),
                          value: orders.filter((o) => o.status === "processing")
                            .length,
                          note: t("Siap dikemas & dikirim", "Ready to pack & ship"),
                          Icon: ShoppingBag,
                          targetTab: "orders",
                        },
                        {
                          label: t("Stok menipis (<15)", "Low stock (<15)"),
                          value: db.products.filter((p) => p.stock < 15).length,
                          note: t(
                            `${db.products.reduce((n, p) => n + p.stock, 0)} unit total tersedia`,
                            `${db.products.reduce((n, p) => n + p.stock, 0)} units total`,
                          ),
                          Icon: Package,
                          targetTab: "products",
                        },
                        {
                          label: t("Pesan terbuka", "Open concierge"),
                          value: db.tickets.filter((x) => x.status === "open")
                            .length,
                          note: t("Perlu balasan tim", "Awaiting team reply"),
                          Icon: MessageSquare,
                          targetTab: "support",
                        },
                      ]
                    : [
                        {
                          label: t(
                            "Laba bersih studio (Margin 42%)",
                            "Studio net profit (42% margin)",
                          ),
                          value: money(studioNetProfit),
                          note: t(
                            `Omzet kotor ${money(studioGross)} · Klik rincian kategori`,
                            `Gross revenue ${money(studioGross)} · Click for breakdown`,
                          ),
                          Icon: BarChart3,
                          targetTab: "profit_chart",
                        },
                        {
                          label: t("Total pesanan", "Total orders"),
                          value: orders.length,
                          note: t(
                            `${orders.filter((o) => o.status === "processing").length} menunggu proses · ${orderValues(orders, money)}`,
                            `${orders.filter((o) => o.status === "processing").length} awaiting · ${orderValues(orders, money)}`,
                          ),
                          Icon: ShoppingBag,
                          targetTab: "orders",
                        },
                        {
                          label: t("Produk aktif", "Active products"),
                          value: db.products.filter((p) => p.active).length,
                          note: t(
                            `${db.products.reduce((n, p) => n + p.stock, 0)} unit tersedia`,
                            `${db.products.reduce((n, p) => n + p.stock, 0)} units in stock`,
                          ),
                          Icon: Package,
                          targetTab: "products",
                        },
                        {
                          label: t("Tim & Member", "Team & Members"),
                          value: db.members.length,
                          note: t(
                            `${db.members.filter((m) => isStudioRole(m.role)).length} tim studio · ${db.subscribers.length} subscriber`,
                            `${db.members.filter((m) => isStudioRole(m.role)).length} studio roles · ${db.subscribers.length} subscribers`,
                          ),
                          Icon: ShieldCheck,
                          targetTab: "team",
                        },
                      ]
                  : [
                      {
                        label: t("Pesanan saya", "My orders"),
                        value: orders.length,
                        note: t("Semua perjalanan Anda", "Every chapter so far"),
                        Icon: ShoppingBag,
                        targetTab: "orders",
                      },
                      {
                        label: t("Dalam perjalanan", "On the way"),
                        value: orders.filter((o) => o.status === "shipped")
                          .length,
                        note: t("Pesanan yang dikirim", "Orders in transit"),
                        Icon: Truck,
                        targetTab: "orders",
                      },
                      {
                        label: t("Koleksi favorit", "Saved pieces"),
                        value: db.favorites.length,
                        note: t(
                          "Pilihan personal Anda",
                          "Your personal selection",
                        ),
                        Icon: Heart,
                        targetTab: "wishlist",
                      },
                      {
                        label: t("Pesanan selesai", "Completed orders"),
                        value: orders.filter((o) => o.status === "delivered")
                          .length,
                        note: t(
                          "Sudah sampai tujuan",
                          "Arrived at their destination",
                        ),
                        Icon: CheckCircle2,
                        targetTab: "orders",
                      },
                    ];
                return cards.map(({ label, value, note, Icon, targetTab }, idx) => (
                  <motion.article
                    className="metric interactive-metric"
                    key={label}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05, duration: 0.32 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => {
                      if (targetTab === "wishlist") {
                        onWishlist();
                      } else if (targetTab === "profit_chart") {
                        setChartTab("profit");
                        setSelectedChartKey((prev) => prev || "Heels");
                        document
                          .getElementById("admin-analytics-panel")
                          ?.scrollIntoView({ behavior: "smooth", block: "center" });
                      } else {
                        setTab(targetTab);
                      }
                    }}
                  >
                    <div>
                      <span>{label}</span>
                      <Icon size={19} />
                    </div>
                    <strong>{value}</strong>
                    <small>{note}</small>
                  </motion.article>
                ));
              })()}
            </div>
            <div className="dashboard-two-col">
              <div className="panel">
                <div className="panel-heading">
                  <h3>{t("Pesanan terbaru", "Recent orders")}</h3>
                  <button
                    className="text-link"
                    onClick={() => setTab("orders")}
                  >
                    {t("Lihat semua", "View all")}
                    <ArrowUpRight size={14} />
                  </button>
                </div>
                <OrdersTable
                  orders={orders.slice(0, 4)}
                  onSelect={setOrder}
                  onExplore={admin ? () => setTab("products") : onShop}
                />
              </div>
              <div
                id="admin-analytics-panel"
                className={admin ? "panel" : "panel member-fit-panel"}
              >
                <div className="panel-heading">
                  <h3>
                    {admin
                      ? t(
                          "Grafik Laba Keuntungan, Stok & Pesanan",
                          "Profit, Margin & Catalog Analytics",
                        )
                      : t("Ringkasan Akun & Fit", "Account & Fit Summary")}
                  </h3>
                  {!admin && (
                    <button
                      type="button"
                      className="button outline small member-fit-head-btn"
                      onClick={() => setTab("profile")}
                    >
                      {t("Kelola profil", "Manage profile")}
                      <ArrowUpRight size={14} />
                    </button>
                  )}
                  {admin && (
                    <div className="chart-tabs" role="group">
                      {(
                        [
                          ["profit", t("Laba & Untung", "Profit & Margin")],
                          ["category", t("Kategori", "Category")],
                          ["stock", t("Status Stok", "Stock Status")],
                          ["orders", t("Pesanan", "Orders")],
                        ] as const
                      ).map(([modeKey, modeLabel]) => (
                        <button
                          key={modeKey}
                          type="button"
                          className={chartTab === modeKey ? "active" : ""}
                          onClick={() => {
                            setChartTab(modeKey);
                            setSelectedChartKey(null);
                          }}
                        >
                          {chartTab === modeKey && (
                            <motion.span
                              layoutId="chart-tab-pill"
                              className="pill-glass-indicator"
                              transition={{
                                type: "spring",
                                stiffness: 480,
                                damping: 34,
                              }}
                            />
                          )}
                          <span>{modeLabel}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {admin ? (
                  <AdminInteractiveChart
                    chartTab={chartTab}
                    products={db.products}
                    orders={orders}
                    selectedKey={selectedChartKey}
                    onSelectKey={(k) =>
                      setSelectedChartKey((prev) => (prev === k ? null : k))
                    }
                    onInspectProduct={(p) => onSelect(p)}
                    onManageProducts={() => setTab("products")}
                    priceText={priceText}
                    currency={currency}
                    money={money}
                    t={t}
                  />
                ) : (
                  <div className="member-fit-summary">
                    <button
                      type="button"
                      className="member-fit-hero"
                      onClick={() => setTab("profile")}
                    >
                      <div className="member-fit-size-badge">
                        <small>EU FIT</small>
                        <strong>{member?.preferredSize || 39}</strong>
                      </div>
                      <div className="member-fit-copy">
                        <span className="member-fit-eyebrow">
                          <Sparkles size={12} />
                          {t("Ukuran & Gaya Favorit", "Preferred Size & Fit")}
                        </span>
                        <strong>
                          {t(
                            `EU ${member?.preferredSize || 39} · Atelier Fit`,
                            `EU ${member?.preferredSize || 39} · Atelier Fit`,
                          )}
                        </strong>
                        <p>
                          {member?.bio
                            ? member.bio
                            : t(
                                "Standar Valerie & CO — ketuk untuk atur fit.",
                                "Valerie & CO standard — tap to edit fit notes.",
                              )}
                        </p>
                      </div>
                      <span className="member-fit-cta">
                        <span>{t("Atur Fit", "Edit Fit")}</span>
                        <ChevronRight size={15} />
                      </span>
                    </button>

                    <div className="member-fit-grid">
                      <button
                        type="button"
                        className="member-fit-card"
                        onClick={() => setTab("settings")}
                      >
                        <div className="member-fit-card-top">
                          <span className="member-fit-icon">
                            <ShieldCheck size={16} />
                          </span>
                          <span
                            className={`member-fit-badge ${member?.security?.twoFactorEnabled ? "ok" : "warn"}`}
                          >
                            {member?.security?.twoFactorEnabled
                              ? t("2FA Aktif", "2FA On")
                              : t("Standar", "Standard")}
                          </span>
                        </div>
                        <small>{t("Status Keamanan", "Security Status")}</small>
                        <strong>
                          {member?.security?.twoFactorEnabled
                            ? t("Verifikasi 2 Langkah Aktif", "2-Step Verification Active")
                            : t("Perlindungan Akun Standar", "Standard Account Protection")}
                        </strong>
                        <span className="member-fit-card-action">
                          {t("Kelola keamanan", "Manage security")}
                          <ArrowUpRight size={13} />
                        </span>
                      </button>

                      <button
                        type="button"
                        className="member-fit-card"
                        onClick={() => setTab("addresses")}
                      >
                        <div className="member-fit-card-top">
                          <span className="member-fit-icon">
                            <MapPin size={16} />
                          </span>
                          <span
                            className={`member-fit-badge ${member?.addresses[0] ? "ok" : "muted"}`}
                          >
                            {member?.addresses[0]
                              ? t("Tersimpan", "Saved")
                              : t("Kosong", "Empty")}
                          </span>
                        </div>
                        <small>{t("Alamat Utama", "Primary Address")}</small>
                        <strong>
                          {member?.addresses[0]
                            ? `${member.addresses[0].street}, ${member.addresses[0].city}`
                            : t("Belum ada alamat tersimpan", "No saved address yet")}
                        </strong>
                        <span className="member-fit-card-action">
                          {member?.addresses[0]
                            ? t("Atur alamat", "Edit address")
                            : t("Tambah alamat", "Add address")}
                          <ArrowUpRight size={13} />
                        </span>
                      </button>
                    </div>

                    <div className="member-fit-footer">
                      <div className="member-fit-footer-head">
                        <span className="member-fit-footer-label">
                          <Mail size={14} />
                          {t("Verifikasi Kontak & OTP", "Contact & OTP Verification")}
                        </span>
                        {(!member?.emailVerified || !member?.phoneVerified) && (
                          <button
                            type="button"
                            className="member-fit-verify-btn"
                            onClick={() => setTab("profile")}
                          >
                            {t("Verifikasi sekarang", "Verify now")}
                            <ArrowUpRight size={13} />
                          </button>
                        )}
                      </div>
                      <div className="verify-chip-row">
                        <span
                          className={`verify-pill ${member?.emailVerified ? "ok" : "pending"}`}
                        >
                          <Mail size={12} />
                          Email ·{" "}
                          {member?.emailVerified
                            ? t("Terverifikasi", "Verified")
                            : t("Belum", "Unverified")}
                        </span>
                        <span
                          className={`verify-pill ${member?.phoneVerified ? "ok" : "pending"}`}
                        >
                          <Smartphone size={12} />
                          WhatsApp ·{" "}
                          {member?.phoneVerified
                            ? t("Terverifikasi", "Verified")
                            : member?.phone
                              ? t("Belum", "Unverified")
                              : t("Kosong", "Missing")}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            {!admin && (
              <section>
                <div className="panel-heading">
                  <h3>
                    {t("Rekomendasi Untuk Anda", "Curated For You")}
                  </h3>
                  <button className="button outline small" onClick={onShop}>
                    {t("Lihat Koleksi", "View Collection")}
                    <ArrowUpRight size={14} />
                  </button>
                </div>
                <div className="product-grid recommendations">
                  {db.products
                    .filter((p) => p.active)
                    .slice(0, 3)
                    .map((p) => (
                      <ProductCard
                        key={p.id}
                        product={p}
                        onSelect={() => onSelect(p)}
                      />
                    ))}
                </div>
              </section>
            )}
          </>
        )}
        {activeTab === "orders" && (
          <OrdersPanel orders={orders} onSelect={setOrder} admin={admin} />
        )}
        {activeTab === "products" && admin && (
          <ProductsPanel canManageCatalog={canManageCatalog} />
        )}
        {activeTab === "customers" && admin && (
          <CustomersPanel canManageRoles={canManageCatalog} activeStudioRole={activeStudioRole} />
        )}
        {activeTab === "coupons" && admin && canManageCatalog && (
          <CouponsPanel />
        )}
        {activeTab === "team" && admin && canManageCatalog && (
          <TeamPanel activeStudioRole={activeStudioRole} />
        )}
        {activeTab === "settings" && admin && canManageCatalog && (
          <SettingsPanel />
        )}
        {activeTab === "settings" && !admin && (
          <MemberSettingsPanel
            lang={lang}
            setLang={setLang}
            saveMember={saveMember}
          />
        )}
        {activeTab === "profile" && !admin && <ProfilePanel />}
        {activeTab === "addresses" && !admin && <AddressesPanel />}
        {activeTab === "support" && <SupportPanel admin={admin} />}
          </motion.div>
        </AnimatePresence>
        <div className="dashboard-footnote">
          {t(
            "Valerie & CO Atelier Studio · Sistem Manajemen Katalog, Pesanan & Pelanggan",
            "Valerie & CO Atelier Studio · Catalogue, Order & Client Management System",
          )}
        </div>
      </div>
      {typeof document !== "undefined" &&
        createPortal(
          <nav
            className="dashboard-mobile-dock"
            aria-label={t("Navigasi dashboard mobile", "Mobile dashboard navigation")}
          >
            {tabs.map(([id, label, IconComp]) => (
              <button
                key={id}
                type="button"
                className={activeTab === id ? "active" : ""}
                aria-current={activeTab === id ? "page" : undefined}
                onClick={(e) => {
                  setTab(id);
                  e.currentTarget.scrollIntoView({
                    block: "nearest",
                    inline: "center",
                    behavior: "smooth",
                  });
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              >
                {activeTab === id && (
                  <motion.span
                    layoutId="dock-active-pill"
                    className="dock-glass-pill"
                    transition={{
                      type: "spring",
                      stiffness: 460,
                      damping: 34,
                      mass: 0.72,
                    }}
                  />
                )}
                <span className="dock-icon">
                  <IconComp size={18} aria-hidden="true" />
                  {id === "orders" && orders.length > 0 && <b>{orders.length}</b>}
                </span>
                <span className="dock-label">{label}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={onShop}
              aria-label={t("Kembali ke toko", "Back to store")}
            >
              <span className="dock-icon">
                <ArrowUpRight size={18} aria-hidden="true" />
              </span>
              <span className="dock-label">{t("Toko", "Store")}</span>
            </button>
          </nav>,
          document.body,
        )}
      {order && db.orders.find((o) => o.id === order) && (
        <OrderModal
          order={db.orders.find((o) => o.id === order)!}
          admin={admin}
          canApproveRefund={canManageCatalog}
          onClose={() => setOrder(null)}
        />
      )}
    </section>
  );
}

type ChartSegment = {
  key: string;
  label: string;
  color: string;
  count: number;
  subtitle: string;
  items: Item[];
  gross?: number;
  cogs?: number;
  profit?: number;
  unitsSold?: number;
  marginPct?: number;
};

function AdminInteractiveChart({
  chartTab,
  products,
  orders,
  selectedKey,
  onSelectKey,
  onInspectProduct,
  onManageProducts,
  priceText,
  currency,
  money,
  t,
}: {
  chartTab: "profit" | "category" | "stock" | "orders";
  products: Item[];
  orders: Order[];
  selectedKey: string | null;
  onSelectKey: (k: string) => void;
  onInspectProduct: (p: Item) => void;
  onManageProducts: () => void;
  priceText: (item: Pick<Item, "price" | "priceIdr">, quantity?: number) => string;
  currency: "IDR" | "USD";
  money: (amount: number, curr?: "IDR" | "USD") => string;
  t: (id: string, en: string) => string;
}) {
  const getProductFinancials = (p: Item) => {
    const unitPrice =
      currency === "IDR" ? (p.priceIdr ?? p.price * 16000) : p.price;
    const orderedUnits = orders
      .filter((o) => o.status !== "cancelled")
      .reduce(
        (sum, o) =>
          sum +
          o.items
            .filter((i) => i.productId === p.id)
            .reduce((s, i) => s + i.quantity, 0),
        0,
      );
    const baseUnits = Math.max(
      2,
      Math.round((40 - Math.min(34, p.stock)) / 4),
    );
    const unitsSold = orderedUnits + baseUnits;
    const gross = unitPrice * unitsSold;
    const cogs = Math.round(gross * 0.58);
    const profit = gross - cogs;
    const unitCogs = Math.round(unitPrice * 0.58);
    const unitProfit = unitPrice - unitCogs;
    return {
      unitPrice,
      unitCogs,
      unitProfit,
      unitsSold,
      orderedUnits,
      gross,
      cogs,
      profit,
    };
  };

  const categoryColors: Record<string, string> = {
    Boots: "#c93b32",
    Heels: "#8b5e3c",
    Sneakers: "#24170f",
    Flatshoes: "#2e6f56",
  };

  const profitSegments: ChartSegment[] = (
    ["Boots", "Heels", "Sneakers", "Flatshoes"] as const
  ).map((cat) => {
    const catItems = products.filter((p) => p.category === cat);
    const fin = catItems.reduce(
      (acc, item) => {
        const f = getProductFinancials(item);
        acc.gross += f.gross;
        acc.cogs += f.cogs;
        acc.profit += f.profit;
        acc.unitsSold += f.unitsSold;
        return acc;
      },
      { gross: 0, cogs: 0, profit: 0, unitsSold: 0 },
    );
    const marginPct =
      fin.gross > 0 ? Math.round((fin.profit / fin.gross) * 100) : 42;
    return {
      key: cat,
      label: cat,
      color: categoryColors[cat] || "#8b5e3c",
      items: catItems,
      count: Math.max(1, fin.profit),
      gross: fin.gross,
      cogs: fin.cogs,
      profit: fin.profit,
      unitsSold: fin.unitsSold,
      marginPct,
      subtitle: `${fin.unitsSold} ${t("pasang terjual", "pairs sold")} · Margin ${marginPct}%`,
    };
  });

  const totalStudioGross = profitSegments.reduce(
    (s, seg) => s + (seg.gross || 0),
    0,
  );
  const totalStudioCogs = profitSegments.reduce(
    (s, seg) => s + (seg.cogs || 0),
    0,
  );
  const totalStudioProfit = profitSegments.reduce(
    (s, seg) => s + (seg.profit || 0),
    0,
  );
  const totalStudioUnits = profitSegments.reduce(
    (s, seg) => s + (seg.unitsSold || 0),
    0,
  );

  const segments: ChartSegment[] =
    chartTab === "profit"
      ? profitSegments
      : chartTab === "category"
      ? [
          {
            key: "Boots",
            label: "Boots",
            color: "#c93b32",
            items: products.filter((p) => p.category === "Boots"),
            count: products.filter((p) => p.category === "Boots").length,
            subtitle: `${products.filter((p) => p.category === "Boots").reduce((n, p) => n + p.stock, 0)} ${t("unit", "units")}`,
          },
          {
            key: "Heels",
            label: "Heels",
            color: "#8b5e3c",
            items: products.filter((p) => p.category === "Heels"),
            count: products.filter((p) => p.category === "Heels").length,
            subtitle: `${products.filter((p) => p.category === "Heels").reduce((n, p) => n + p.stock, 0)} ${t("unit", "units")}`,
          },
          {
            key: "Sneakers",
            label: "Sneakers",
            color: "#24170f",
            items: products.filter((p) => p.category === "Sneakers"),
            count: products.filter((p) => p.category === "Sneakers").length,
            subtitle: `${products.filter((p) => p.category === "Sneakers").reduce((n, p) => n + p.stock, 0)} ${t("unit", "units")}`,
          },
          {
            key: "Flatshoes",
            label: "Flatshoes",
            color: "#c98b5b",
            items: products.filter((p) => p.category === "Flatshoes"),
            count: products.filter((p) => p.category === "Flatshoes").length,
            subtitle: `${products.filter((p) => p.category === "Flatshoes").reduce((n, p) => n + p.stock, 0)} ${t("unit", "units")}`,
          },
        ]
      : chartTab === "stock"
        ? [
            {
              key: "low",
              label: t("Stok Menipis (<15)", "Low Stock (<15)"),
              color: "#c93b32",
              items: products.filter((p) => p.stock < 15),
              count: products.filter((p) => p.stock < 15).length,
              subtitle: t("Perlu restok segera", "Needs restock"),
            },
            {
              key: "mid",
              label: t("Stok Sedang (15–25)", "Moderate (15–25)"),
              color: "#d18b47",
              items: products.filter((p) => p.stock >= 15 && p.stock <= 25),
              count: products.filter((p) => p.stock >= 15 && p.stock <= 25).length,
              subtitle: t("Stok terjaga", "Balanced level"),
            },
            {
              key: "safe",
              label: t("Stok Aman (>25)", "Healthy (>25)"),
              color: "#2e6f56",
              items: products.filter((p) => p.stock > 25),
              count: products.filter((p) => p.stock > 25).length,
              subtitle: t("Siap jual", "Ready to ship"),
            },
          ]
        : (
            [
              ["cancelled", t("Dibatalkan", "Cancelled"), "#c93b32"],
              ["processing", t("Diproses", "Processing"), "#d18b47"],
              ["shipped", t("Dikirim", "Shipped"), "#8b5e3c"],
              ["delivered", t("Selesai", "Delivered"), "#2e6f56"],
            ] as const
          ).map(([st, label, color]) => {
            const matchingOrders = orders.filter((o) => o.status === st);
            const orderedIds = new Set(
              matchingOrders.flatMap((o) => o.items.map((i) => i.productId)),
            );
            const items = products.filter((p) => orderedIds.has(p.id));
            return {
              key: st,
              label,
              color,
              items,
              count: matchingOrders.length,
              subtitle: `${items.length} ${t("model terkait", "linked models")}`,
            };
          });

  const total = Math.max(
    1,
    segments.reduce((n, s) => n + s.count, 0),
  );
  const activeSegment =
    segments.find((s) => s.key === selectedKey) || null;
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  let accumulated = 0;

  return (
    <div className="admin-chart-shell">
      {chartTab === "profit" && (
        <div className="profit-summary-strip">
          <div className="profit-summary-card highlight">
            <span>{t("LABA BERSIH STUDIO (42%)", "STUDIO NET PROFIT (42%)")}</span>
            <strong>{money(totalStudioProfit)}</strong>
            <small>
              {t(
                "Keuntungan bersih setelah HPP produksi",
                "Net earnings after atelier COGS",
              )}
            </small>
          </div>
          <div className="profit-summary-card">
            <span>{t("OMZET KOTOR (GROSS)", "GROSS REVENUE")}</span>
            <strong>{money(totalStudioGross)}</strong>
            <small>
              {totalStudioUnits} {t("pasang sepatu terjual", "pairs sold")}
            </small>
          </div>
          <div className="profit-summary-card">
            <span>{t("MODAL / HPP PRODUKSI (58%)", "EST. COGS / MODAL (58%)")}</span>
            <strong>{money(totalStudioCogs)}</strong>
            <small>
              {t(
                "Material kulit, kriya & kemasan",
                "Leather, craftsmanship & packaging",
              )}
            </small>
          </div>
        </div>
      )}

      <div className="admin-chart-stage">
        <div className="admin-donut-wrap">
          <svg viewBox="0 0 128 128" className="admin-donut-svg" aria-hidden="false">
            <circle
              cx="64"
              cy="64"
              r={radius}
              fill="none"
              stroke="rgba(139, 94, 60, 0.12)"
              strokeWidth="18"
            />
            {segments.map((seg) => {
              const frac = seg.count / total;
              const segLen = Math.max(frac > 0 ? 4 : 0, frac * circumference);
              const offset = -accumulated;
              accumulated += frac * circumference;
              const isSelected = selectedKey === seg.key;
              return (
                <motion.circle
                  key={seg.key}
                  cx="64"
                  cy="64"
                  r={radius}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={isSelected ? 22 : 18}
                  strokeDasharray={`${segLen} ${circumference}`}
                  strokeDashoffset={offset}
                  strokeLinecap="butt"
                  className="donut-slice"
                  opacity={selectedKey && !isSelected ? 0.34 : 1}
                  initial={{ strokeDasharray: `0 ${circumference}` }}
                  animate={{
                    strokeDasharray: `${segLen} ${circumference}`,
                    strokeWidth: isSelected ? 22 : 18,
                  }}
                  transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                  onClick={() => onSelectKey(seg.key)}
                  style={{ cursor: "pointer", pointerEvents: "visibleStroke" }}
                >
                  <title>
                    {chartTab === "profit"
                      ? `${seg.label}: ${money(seg.profit || 0)}`
                      : `${seg.label}: ${seg.count}`}
                  </title>
                </motion.circle>
              );
            })}
          </svg>
          <div className="admin-donut-center">
            <strong>
              {chartTab === "profit"
                ? activeSegment
                  ? `${Math.round(((activeSegment.profit || 0) / Math.max(1, totalStudioProfit)) * 100)}%`
                  : "+42%"
                : activeSegment
                  ? activeSegment.count
                  : total}
            </strong>
            <span>
              {activeSegment
                ? activeSegment.label
                : chartTab === "profit"
                  ? t("Margin Laba", "Profit Margin")
                  : chartTab === "orders"
                    ? t("Pesanan", "Orders")
                    : t("Produk", "Items")}
            </span>
          </div>
        </div>

        <div className="admin-chart-legend">
          {segments.map((seg) => {
            const pct = Math.round((seg.count / total) * 100);
            const active = selectedKey === seg.key;
            return (
              <motion.button
                key={seg.key}
                type="button"
                className={`chart-legend-row ${active ? "active" : ""}`}
                whileHover={{ x: 2 }}
                whileTap={{ scale: 0.985 }}
                onClick={() => onSelectKey(seg.key)}
              >
                <div className="chart-legend-head">
                  <span>
                    <i style={{ background: seg.color }} />
                    <b>{seg.label}</b>
                  </span>
                  <small>
                    {chartTab === "profit" ? (
                      <>
                        <strong>{money(seg.profit || 0)}</strong> ({pct}%) ·{" "}
                        {seg.unitsSold} {t("psg", "prs")}
                      </>
                    ) : (
                      <>
                        {seg.count} ({pct}%) · {seg.subtitle}
                      </>
                    )}
                  </small>
                </div>
                <div className="chart-legend-track">
                  <motion.span
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(seg.count > 0 ? 6 : 0, pct)}%` }}
                    transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                    style={{ background: seg.color }}
                  />
                </div>
                {chartTab === "profit" && (
                  <div className="profit-bar-subrow">
                    <span>
                      {t("Omzet:", "Gross:")} {money(seg.gross || 0)}
                    </span>
                    <span>
                      {t("HPP:", "COGS:")} {money(seg.cogs || 0)}
                    </span>
                    <em className="profit-click-hint">
                      {active
                        ? t("Tutup rincian ▲", "Hide details ▲")
                        : t("Klik untuk rincian ▼", "Click for breakdown ▼")}
                    </em>
                  </div>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      {!activeSegment && (
        <p className="chart-click-prompt">
          {t(
            "💡 Ketuk salah satu batang grafik atau segmen lingkaran di atas untuk membuka rincian laba bersih, HPP, dan kontribusi per produk.",
            "💡 Tap any bar or donut segment above to inspect net profit, COGS, and per-SKU contribution.",
          )}
        </p>
      )}

      <AnimatePresence mode="wait">
        {activeSegment && (
          <motion.div
            key={activeSegment.key}
            className="chart-drilldown"
            initial={{ opacity: 0, y: 10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -6, height: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="chart-drilldown-head">
              <div>
                <i style={{ background: activeSegment.color }} />
                <strong>
                  {chartTab === "profit"
                    ? t(
                        `Rincian Laba & Keuntungan: ${activeSegment.label}`,
                        `Profit & Financial Breakdown: ${activeSegment.label}`,
                      )
                    : `${activeSegment.label} (${activeSegment.items.length} ${t("produk", "products")})`}
                </strong>
              </div>
              <div className="chart-drilldown-actions">
                <button
                  type="button"
                  className="button outline small"
                  onClick={onManageProducts}
                >
                  {t("Kelola di Produk", "Manage Products")}
                </button>
                <button
                  type="button"
                  className="button outline small"
                  onClick={() => onSelectKey(activeSegment.key)}
                >
                  {t("Tutup", "Close")}
                </button>
              </div>
            </div>

            {chartTab === "profit" && (
              <div className="profit-drilldown-kpis">
                <div>
                  <span>{t("Laba Bersih Kategori", "Category Net Profit")}</span>
                  <strong className="profit-positive">
                    +{money(activeSegment.profit || 0)}
                  </strong>
                  <small>
                    {t("Margin keuntungan", "Profit margin")}{" "}
                    {activeSegment.marginPct || 42}%
                  </small>
                </div>
                <div>
                  <span>{t("Pendapatan Kotor (Omzet)", "Gross Revenue")}</span>
                  <strong>{money(activeSegment.gross || 0)}</strong>
                  <small>
                    {activeSegment.unitsSold || 0}{" "}
                    {t("pasang terjual", "pairs sold")}
                  </small>
                </div>
                <div>
                  <span>{t("Modal Produksi (HPP 58%)", "Production COGS (58%)")}</span>
                  <strong>{money(activeSegment.cogs || 0)}</strong>
                  <small>
                    {t("Biaya material & kriya", "Material & atelier cost")}
                  </small>
                </div>
              </div>
            )}

            {activeSegment.items.length ? (
              <div className="chart-drilldown-grid">
                {activeSegment.items.map((item) => {
                  const fin = getProductFinancials(item);
                  return (
                    <motion.button
                      key={item.id}
                      type="button"
                      className="chart-drilldown-card"
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.985 }}
                      onClick={() => onInspectProduct(item)}
                    >
                      <CutoutImg
                        src={item.showcaseImage || item.images[0]}
                        alt={item.name}
                      />
                      <span>
                        <b>{item.name}</b>
                        {chartTab === "profit" ? (
                          <small className="profit-sku-breakdown">
                            <span>
                              {t("Terjual", "Sold")}: <b>{fin.unitsSold} psg</b> ·{" "}
                              {t("Harga", "Price")}: {money(fin.unitPrice)}
                            </span>
                            <span>
                              {t("HPP/psg", "COGS/pr")}: {money(fin.unitCogs)} ·{" "}
                              {t("Untung/psg", "Profit/pr")}:{" "}
                              <strong className="profit-positive">
                                +{money(fin.unitProfit)}
                              </strong>
                            </span>
                            <span className="profit-sku-total">
                              {t("Total Laba Produk:", "Total SKU Profit:")}{" "}
                              <strong>+{money(fin.profit)}</strong>
                            </span>
                          </small>
                        ) : (
                          <small>
                            {item.category} · {priceText(item)} · {item.stock}{" "}
                            {t("stok", "left")}
                          </small>
                        )}
                      </span>
                      <ArrowUpRight size={14} />
                    </motion.button>
                  );
                })}
              </div>
            ) : (
              <p className="chart-empty-note">
                {t(
                  "Belum ada produk pada segmen ini saat ini.",
                  "No matching products in this segment right now.",
                )}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function OrdersTable({
  orders,
  onSelect,
  onExplore,
}: {
  orders: Order[];
  onSelect: (id: string) => void;
  onExplore?: () => void;
}) {
  const { t, money } = useStore();
  return orders.length ? (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>{t("Pesanan", "Order")}</th>
            <th>{t("Pelanggan", "Customer")}</th>
            <th>Status</th>
            <th>Total</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id}>
              <td data-label={t("Pesanan", "Order")}>
                <button
                  className="table-link"
                  title={o.id}
                  onClick={() => onSelect(o.id)}
                >
                  {o.id}
                </button>
                <small>
                  {o.receiptNumber || `VCO-INV-${o.id.slice(-8).toUpperCase()}`} ·{" "}
                  {new Date(o.date).toLocaleDateString()}
                </small>
              </td>
              <td data-label={t("Pelanggan", "Customer")}>
                {o.name}
                <small>
                  {o.items.reduce((n, i) => n + i.quantity, 0)}{" "}
                  {t("produk", "items")}
                </small>
              </td>
              <td data-label="Status">
                <div className="order-status-stack">
                  <Status status={o.status} />
                  {o.refund && (
                    <span className={`refund-pill ${o.refund.status}`}>
                      {o.refund.status === "refunded"
                        ? "Refunded"
                        : o.refund.status === "requested"
                          ? t("Refund Diminta", "Refund Requested")
                          : t("Refund Ditolak", "Refund Declined")}
                    </span>
                  )}
                </div>
              </td>
              <td data-label="Total" className="table-price-cell">
                {money(o.total, o.currency || "USD")}
              </td>
              <td data-label={t("Aksi", "Action")}>
                <button
                  type="button"
                  className="table-action-pill"
                  aria-label={t("Detail pesanan", "Order details")}
                  onClick={() => onSelect(o.id)}
                >
                  <span>{t("Detail", "Details")}</span>
                  <ArrowUpRight size={14} aria-hidden="true" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <Empty
      title={t("Belum ada pesanan", "No orders yet")}
      body={t(
        "Pesanan dari checkout akan tampil di sini.",
        "Orders from checkout will appear here.",
      )}
      action={onExplore ? t("Jelajahi Koleksi", "Browse Collection") : undefined}
      onAction={onExplore}
    />
  );
}
function OrdersPanel({
  orders,
  onSelect,
  admin,
}: {
  orders: Order[];
  onSelect: (id: string) => void;
  admin: boolean;
}) {
  const { t, money, updateOrder, notify } = useStore();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [viewMode, setViewMode] = useState<"table" | "board">(
    admin ? "board" : "table",
  );
  const list = orders.filter(
    (o) =>
      (status === "all" ||
        (status === "refund_requested"
          ? o.refund?.status === "requested"
          : status === "refunded"
            ? o.refund?.status === "refunded" || o.payment?.status === "refunded"
            : o.status === status)) &&
      `${o.id} ${o.receiptNumber || ""} ${o.name} ${o.email}`
        .toLowerCase()
        .includes(q.toLowerCase()),
  );
  return (
    <div className="panel">
      <div className="panel-heading">
        <h3>
          {t("Semua pesanan", "All orders")} ({orders.length})
        </h3>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {admin && (
            <div className="view-toggle-pills" role="group">
              <button
                type="button"
                className={viewMode === "board" ? "active" : ""}
                onClick={() => setViewMode("board")}
              >
                {viewMode === "board" && (
                  <motion.span
                    layoutId="orders-view-pill"
                    className="pill-glass-indicator"
                    transition={{ type: "spring", stiffness: 480, damping: 34 }}
                  />
                )}
                <Columns3 size={14} />
                <span>Kanban</span>
              </button>
              <button
                type="button"
                className={viewMode === "table" ? "active" : ""}
                onClick={() => setViewMode("table")}
              >
                {viewMode === "table" && (
                  <motion.span
                    layoutId="orders-view-pill"
                    className="pill-glass-indicator"
                    transition={{ type: "spring", stiffness: 480, damping: 34 }}
                  />
                )}
                <LayoutGrid size={14} />
                <span>{t("Tabel", "Table")}</span>
              </button>
            </div>
          )}
          <button
            className="button outline small"
            onClick={() =>
              csvDownload("valerie-orders.csv", [
                [
                  "Order",
                  "Receipt",
                  "Customer",
                  "Email",
                  "Status",
                  "Total",
                  "Currency",
                  "Payment",
                  "Refund Status",
                  "Refund Ref",
                  "Date",
                ],
                ...list.map((o) => [
                  o.id,
                  o.receiptNumber || `VCO-INV-${o.id.slice(-8).toUpperCase()}`,
                  o.name,
                  o.email,
                  o.status,
                  o.total,
                  o.currency || "USD",
                  o.payment?.status || "direct",
                  o.refund?.status || "none",
                  o.refund?.reference || "-",
                  o.date,
                ]),
              ])
            }
          >
            <Download size={15} />
            {t("Ekspor CSV", "Export CSV")}
          </button>
        </div>
      </div>
      <div className="table-toolbar">
        <label className="search-input">
          <Search size={16} />
          <input
            placeholder={t("Cari pesanan / struk…", "Search orders / invoice…")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        <select
          aria-label={t("Status pesanan", "Order status")}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="all">{t("Semua status", "All statuses")}</option>
          <option value="processing">{t("Diproses", "Processing")}</option>
          <option value="shipped">{t("Dikirim", "Shipped")}</option>
          <option value="delivered">{t("Selesai", "Delivered")}</option>
          <option value="cancelled">{t("Dibatalkan", "Cancelled")}</option>
          <option value="refund_requested">{t("Pengajuan Refund", "Refund Requested")}</option>
          <option value="refunded">{t("Sudah Direfund", "Refunded")}</option>
        </select>
      </div>
      {viewMode === "board" && admin ? (
        <div className="kanban-board">
          {(
            [
              ["processing", t("Diproses", "Processing")],
              ["shipped", t("Dikirim", "Shipped")],
              ["delivered", t("Selesai", "Delivered")],
              ["cancelled", t("Dibatalkan", "Cancelled")],
            ] as const
          ).map(([colKey, colLabel]) => {
            const colOrders = list.filter((o) => o.status === colKey);
            return (
              <div className="kanban-col" key={colKey}>
                <div className="kanban-col-head">
                  <span>{colLabel}</span>
                  <b>{colOrders.length}</b>
                </div>
                <div className="kanban-col-body">
                  {colOrders.map((o) => (
                    <motion.article
                      layout
                      key={o.id}
                      className="kanban-card"
                      whileHover={{ y: -3, scale: 1.01 }}
                    >
                      <div className="kanban-card-top">
                        <button
                          type="button"
                          className="table-link"
                          title={o.id}
                          onClick={() => onSelect(o.id)}
                        >
                          {o.id}
                        </button>
                        <strong>{money(o.total, o.currency || "USD")}</strong>
                      </div>
                      <p className="kanban-customer">
                        {o.name} ·{" "}
                        {o.items.reduce((n, i) => n + i.quantity, 0)}{" "}
                        {t("item", "items")}
                      </p>
                      <div className="kanban-card-actions">
                        <button
                          type="button"
                          className="text-link"
                          onClick={() => onSelect(o.id)}
                        >
                          {t("Detail", "Details")}
                        </button>
                        {colKey === "processing" && (
                          <button
                            type="button"
                            className="kanban-advance-btn"
                            onClick={() => {
                              updateOrder(
                                o.id,
                                "shipped",
                                o.tracking ||
                                  `VCO-${Math.floor(100000 + Math.random() * 900000)}`,
                              );
                              notify(
                                "Pesanan ditandai dikirim",
                                "Order marked as shipped",
                              );
                            }}
                          >
                            {t("Kirim →", "Ship →")}
                          </button>
                        )}
                        {colKey === "shipped" && (
                          <button
                            type="button"
                            className="kanban-advance-btn"
                            onClick={() => {
                              updateOrder(o.id, "delivered", o.tracking);
                              notify(
                                "Pesanan selesai!",
                                "Order completed!",
                              );
                              try {
                                confetti({
                                  particleCount: 40,
                                  spread: 55,
                                  origin: { y: 0.7 },
                                });
                              } catch {}
                            }}
                          >
                            {t("Selesai ✓", "Deliver ✓")}
                          </button>
                        )}
                      </div>
                    </motion.article>
                  ))}
                  {!colOrders.length && (
                    <small className="kanban-empty">
                      {t("Tidak ada pesanan", "No orders")}
                    </small>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <OrdersTable orders={list} onSelect={onSelect} />
      )}
    </div>
  );
}
function OrderModal({
  order: o,
  admin,
  canApproveRefund = true,
  onClose,
}: {
  order: Order;
  admin: boolean;
  canApproveRefund?: boolean;
  onClose: () => void;
}) {
  const { db, t, lang, money, updateOrder, refundOrder, notify } = useStore();
  const [status, setStatus] = useState(o.status);
  const [tracking, setTracking] = useState(o.tracking);
  const [cancel, setCancel] = useState(false);
  const [view, setView] = useState<"details" | "receipt">("details");
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundReason, setRefundReason] = useState(o.refund?.reason || "");
  const [refundRef, setRefundRef] = useState("");
  const [manualRefund, setManualRefund] = useState(false);
  const [refundBusy, setRefundBusy] = useState(false);
  const terminal = ["cancelled", "delivered"].includes(o.status);
  const receiptNo =
    o.receiptNumber || `VCO-INV-${o.id.replace(/^SOL-/, "").slice(0, 8).toUpperCase()}`;
  const subtotal = o.items.reduce((n, i) => n + i.price * i.quantity, 0);
  const storeName = db.settings.name || "Valerie & CO";
  const isRefunded =
    o.refund?.status === "refunded" || o.payment?.status === "refunded";
  const canMemberRefund =
    !admin &&
    o.status !== "cancelled" &&
    (!o.payment || o.payment.status === "paid") &&
    (!o.refund || o.refund.status === "rejected");
  const canAdminRefund =
    admin &&
    canApproveRefund &&
    !isRefunded &&
    (o.payment ? o.payment.status === "paid" : o.status !== "cancelled");

  return (
    <Modal title={`${o.id} · ${receiptNo}`} onClose={onClose} wide>
      <div className="order-modal-topbar no-print">
        <div className="view-toggle-pills" role="group">
          <button
            type="button"
            className={view === "details" ? "active" : ""}
            onClick={() => setView("details")}
          >
            <ShoppingBag size={14} />
            <span>{t("Detail Pesanan", "Order Details")}</span>
          </button>
          <button
            type="button"
            className={view === "receipt" ? "active" : ""}
            onClick={() => setView("receipt")}
          >
            <Receipt size={14} />
            <span>{t("Struk / Invoice", "Receipt / Invoice")}</span>
          </button>
        </div>
        <div className="order-receipt-actions">
          <button
            type="button"
            className="button outline small"
            onClick={() => {
              setView("receipt");
              setTimeout(() => window.print(), 80);
            }}
          >
            <Printer size={14} />
            {t("Cetak Struk", "Print Receipt")}
          </button>
          <button
            type="button"
            className="button outline small"
            onClick={() => downloadReceiptHtml(o, receiptNo, storeName, lang, money)}
          >
            <Download size={14} />
            {t("Unduh Struk", "Download Receipt")}
          </button>
        </div>
      </div>

      {view === "receipt" ? (
        <div className="printable-receipt receipt-sheet">
          <div className="receipt-header">
            <div>
              <span className="eyebrow">{storeName.toUpperCase()}</span>
              <h3>{t("Struk Pembelian Resmi", "Official Purchase Receipt")}</h3>
              <p>Atelier &amp; Curated Footwear · {db.settings.email}</p>
            </div>
            <div className="receipt-meta-right">
              <b>{receiptNo}</b>
              <small>{o.id}</small>
              <small>{new Date(o.date).toLocaleString()}</small>
            </div>
          </div>

          <div className="receipt-parties">
            <div>
              <small>{t("Pelanggan & Pengiriman", "Customer & Delivery")}</small>
              <b>{o.address.name || o.name}</b>
              <p>
                {o.email} · {o.address.phone}
                <br />
                {o.address.street}, {o.address.city} {o.address.postal}
              </p>
            </div>
            <div>
              <small>{t("Informasi Pembayaran", "Payment Information")}</small>
              <b>
                {o.payment
                  ? `Midtrans (${o.payment.method || "QRIS / VA"}${o.payment.sandbox ? " · Sandbox" : ""})`
                  : t("Checkout Langsung", "Direct Checkout")}
              </b>
              <p>
                Status:{" "}
                <b>
                  {(o.payment?.status || (o.status === "cancelled" ? "cancelled" : "paid")).toUpperCase()}
                </b>
                {o.payment?.transactionId && (
                  <>
                    <br />
                    Tx ID: {o.payment.transactionId}
                  </>
                )}
                {o.payment?.paidAt && (
                  <>
                    <br />
                    {t("Lunas", "Paid")}: {new Date(o.payment.paidAt).toLocaleString()}
                  </>
                )}
                {o.tracking && (
                  <>
                    <br />
                    {t("Resi", "Tracking")}: {o.tracking}
                  </>
                )}
              </p>
            </div>
          </div>

          <table className="receipt-items-table">
            <thead>
              <tr>
                <th>{t("Produk & Kode SKU", "Product & SKU")}</th>
                <th>{t("Varian", "Variant")}</th>
                <th>Qty</th>
                <th>{t("Harga", "Price")}</th>
                <th>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {o.items.map((i, idx) => (
                <tr key={idx}>
                  <td>
                    <b>{i.name}</b>
                    <small className="receipt-sku">
                      {i.productCode || i.productId.toUpperCase()}
                    </small>
                  </td>
                  <td>EU {i.size}</td>
                  <td>{i.quantity}</td>
                  <td>{money(i.price, o.currency || "USD")}</td>
                  <td>{money(i.price * i.quantity, o.currency || "USD")}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="order-totals receipt-totals">
            <div>
              <span>Subtotal</span>
              <span>{money(subtotal, o.currency || "USD")}</span>
            </div>
            <div>
              <span>{t("Diskon", "Discount")}</span>
              <span>−{money(o.discount, o.currency || "USD")}</span>
            </div>
            <div>
              <span>{t("Pengiriman", "Shipping")}</span>
              <span>{money(o.shipping, o.currency || "USD")}</span>
            </div>
            <div className="grand-total">
              <b>{t("Total Dibayar", "Total Paid")}</b>
              <b>{money(o.total, o.currency || "USD")}</b>
            </div>
          </div>

          {o.refund && (
            <div className={`receipt-refund-stamp ${o.refund.status}`}>
              <b>
                {o.refund.status === "refunded"
                  ? t("BUKTI REFUND RESMI / DANA DIKEMBALIKAN", "OFFICIAL REFUND RECORD")
                  : o.refund.status === "requested"
                    ? t("PENGAJUAN REFUND SEDANG DIPROSES", "REFUND REQUEST PENDING")
                    : t("PENGAJUAN REFUND DITOLAK", "REFUND REQUEST DECLINED")}
              </b>
              <p>
                {t("Nominal", "Amount")}:{" "}
                <b>{money(o.refund.amount, o.refund.currency || o.currency || "USD")}</b>
                {o.refund.reference && ` · Ref: ${o.refund.reference}`}
                {o.refund.refundedAt &&
                  ` · ${new Date(o.refund.refundedAt).toLocaleString()}`}
                <br />
                {t("Alasan", "Reason")}: {o.refund.reason}
                {o.refund.refundedBy && ` · By ${o.refund.refundedBy}`}
              </p>
            </div>
          )}

          <p className="receipt-footer-note">
            {t(
              `Simpan struk digital ini (${receiptNo}) sebagai bukti pembelian sah di ${storeName} untuk klaim garansi, penukaran ukuran, atau proses refund.`,
              `Keep this digital receipt (${receiptNo}) as valid proof of purchase at ${storeName} for warranty claims, exchanges, or refunds.`,
            )}
          </p>
        </div>
      ) : (
        <>
          <div className="order-detail-heading">
            <div className="order-status-stack">
              <Status status={o.status} />
              {o.refund && (
                <span className={`refund-pill ${o.refund.status}`}>
                  {o.refund.status === "refunded"
                    ? "Refunded"
                    : o.refund.status === "requested"
                      ? t("Refund Diminta", "Refund Requested")
                      : t("Refund Ditolak", "Refund Declined")}
                </span>
              )}
            </div>
            <span>
              {receiptNo} · {new Date(o.date).toLocaleString()}
            </span>
          </div>
          {o.status !== "cancelled" && (
            <div className="order-steps">
              {[
                ["processing", t("Diproses", "Processing")],
                ["shipped", t("Dikirim", "Shipped")],
                ["delivered", t("Selesai", "Delivered")],
              ].map(([key, label], i) => (
                <span
                  key={key}
                  className={
                    ["processing", "shipped", "delivered"].indexOf(o.status) >= i
                      ? "done"
                      : ""
                  }
                >
                  <i>
                    <Check size={14} />
                  </i>
                  {label}
                </span>
              ))}
            </div>
          )}
          {o.payment && <PaymentPanel order={o} />}

          {o.refund && (
            <div
              className={`notice refund-notice ${o.refund.status}`}
              style={{ marginBottom: 14 }}
            >
              <div>
                <b>
                  <RotateCcw size={14} style={{ verticalAlign: "-2px", marginRight: 6 }} />
                  {o.refund.status === "refunded"
                    ? t("Dana Sudah Direfund", "Order Refunded")
                    : o.refund.status === "requested"
                      ? t("Menunggu Konfirmasi Refund Admin", "Refund Request Pending Review")
                      : t("Pengajuan Refund Ditolak", "Refund Request Declined")}
                </b>
                <p style={{ margin: "4px 0 0" }}>
                  {t("Nominal", "Amount")}:{" "}
                  {money(o.refund.amount, o.refund.currency || o.currency || "USD")}{" "}
                  ·{" "}
                  {t("Alasan", "Reason")}: {o.refund.reason}
                  {o.refund.reference && (
                    <>
                      <br />
                      Ref: <code>{o.refund.reference}</code>
                    </>
                  )}
                </p>
              </div>
              {admin && o.refund.status === "requested" && (
                <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="button dark small"
                    disabled={refundBusy}
                    onClick={async () => {
                      setRefundBusy(true);
                      try {
                        await refundOrder(o.id, o.refund!.reason, {
                          action: "approve",
                          manual: manualRefund,
                          reference: refundRef,
                        });
                        onClose();
                      } catch (e) {
                        notify((e as Error).message, (e as Error).message);
                      } finally {
                        setRefundBusy(false);
                      }
                    }}
                  >
                    {t("Setujui & Proses Refund + Pulihkan Stok", "Approve Refund & Restore Stock")}
                  </button>
                  <button
                    type="button"
                    className="button outline small"
                    disabled={refundBusy}
                    onClick={async () => {
                      setRefundBusy(true);
                      try {
                        await refundOrder(o.id, refundReason || "Tidak memenuhi syarat retur", {
                          action: "reject",
                        });
                      } catch (e) {
                        notify((e as Error).message, (e as Error).message);
                      } finally {
                        setRefundBusy(false);
                      }
                    }}
                  >
                    {t("Tolak Pengajuan", "Decline")}
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="order-detail-grid">
            <div>
              {o.items.map((i, n) => (
                <div className="checkout-item" key={n}>
                  <img src={i.image} alt="" />
                  <span>
                    <b>{i.name}</b>
                    <small className="sku-inline">
                      SKU: {i.productCode || i.productId.toUpperCase()}
                    </small>
                    <small>
                      EU {i.size} · {i.quantity} ×{" "}
                      {money(i.price, o.currency || "USD")}
                    </small>
                  </span>
                </div>
              ))}
            </div>
            <div className="address-summary">
              <h4>{t("Dikirim ke", "Deliver to")}</h4>
              <b>{o.address.name}</b>
              <p>
                {o.address.street}
                <br />
                {o.address.city}, {o.address.postal}
                <br />
                {o.address.phone}
              </p>
              <h4>{t("Nomor resi", "Tracking number")}</h4>
              <p>{o.tracking || t("Belum tersedia", "Not available yet")}</p>
            </div>
          </div>
          <div className="order-totals">
            <div>
              <span>Subtotal</span>
              <span>{money(subtotal, o.currency || "USD")}</span>
            </div>
            <div>
              <span>{t("Diskon", "Discount")}</span>
              <span>−{money(o.discount, o.currency || "USD")}</span>
            </div>
            <div>
              <span>{t("Pengiriman", "Shipping")}</span>
              <span>{money(o.shipping, o.currency || "USD")}</span>
            </div>
            <div className="grand-total">
              <b>Total</b>
              <b>{money(o.total, o.currency || "USD")}</b>
            </div>
          </div>
          {admin && !terminal && (
            <form
              className="form-grid admin-order-form"
              onSubmit={(e) => {
                e.preventDefault();
                updateOrder(o.id, status, tracking);
                notify("Pesanan diperbarui", "Order updated");
                onClose();
              }}
            >
              <label>
                Status
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as Order["status"])}
                >
                  {(o.status === "processing"
                    ? ["processing", "shipped", "cancelled"]
                    : ["shipped", "delivered"]
                  ).map((v) => (
                    <option key={v} value={v}>
                      {v === "processing"
                        ? t("Diproses", "Processing")
                        : v === "shipped"
                          ? t("Dikirim", "Shipped")
                          : v === "cancelled"
                            ? t("Dibatalkan", "Cancelled")
                            : t("Selesai", "Delivered")}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t("Nomor resi", "Tracking number")}
                <input
                  value={tracking}
                  onChange={(e) => setTracking(e.target.value)}
                  required={status === "shipped"}
                />
              </label>
              <button className="button dark" type="submit">
                {t("Simpan perubahan", "Save changes")}
              </button>
            </form>
          )}

          {(canAdminRefund || canMemberRefund) && (
            <div className="refund-action-wrap no-print">
              {refundOpen ? (
                <form
                  className="refund-box form-grid"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setRefundBusy(true);
                    try {
                      await refundOrder(o.id, refundReason, {
                        action: admin ? "approve" : "request",
                        manual: manualRefund,
                        reference: refundRef,
                      });
                      setRefundOpen(false);
                      onClose();
                    } catch (err) {
                      notify((err as Error).message, (err as Error).message);
                    } finally {
                      setRefundBusy(false);
                    }
                  }}
                >
                  <label className="span-two">
                    {admin
                      ? t("Alasan refund & catatan admin", "Refund reason & admin note")
                      : t("Alasan pengajuan refund", "Reason for refund request")}
                    <input
                      required
                      value={refundReason}
                      onChange={(e) => setRefundReason(e.target.value)}
                      placeholder={t(
                        "Contoh: Ukuran tidak sesuai / Barang dikembalikan sesuai struk",
                        "E.g. Size exchange unavailable / Customer return per receipt",
                      )}
                    />
                  </label>
                  {admin && o.payment && (
                    <>
                      <label className="checkbox-label span-two">
                        <input
                          type="checkbox"
                          checked={manualRefund}
                          onChange={(e) => setManualRefund(e.target.checked)}
                        />
                        {t(
                          "Catat sebagai refund transfer manual (bukan auto-refund Midtrans)",
                          "Record as manual bank transfer refund (skip Midtrans API call)",
                        )}
                      </label>
                      {manualRefund && (
                        <label className="span-two">
                          {t("Referensi transfer bank (opsional)", "Bank transfer reference (optional)")}
                          <input
                            value={refundRef}
                            onChange={(e) => setRefundRef(e.target.value)}
                            placeholder="TRF-BCA-882190"
                          />
                        </label>
                      )}
                    </>
                  )}
                  <div className="span-two" style={{ display: "flex", gap: 8 }}>
                    <button
                      className="button dark small"
                      type="submit"
                      disabled={refundBusy}
                    >
                      <RotateCcw size={14} />
                      {admin
                        ? t(
                            "Konfirmasi Refund & Kembalikan Stok",
                            "Confirm Refund & Restore Stock",
                          )
                        : t("Kirim Pengajuan Refund", "Submit Refund Request")}
                    </button>
                    <button
                      type="button"
                      className="button outline small"
                      onClick={() => setRefundOpen(false)}
                    >
                      {t("Batal", "Cancel")}
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  type="button"
                  className="button outline small"
                  onClick={() => setRefundOpen(true)}
                >
                  <RotateCcw size={14} />
                  {admin
                    ? t("Proses Refund Pesanan", "Process Order Refund")
                    : t("Ajukan Refund Berdasarkan Struk", "Request Refund")}
                </button>
              )}
            </div>
          )}

          {!admin &&
            !o.payment &&
            o.status === "processing" &&
            !isRefunded &&
            (cancel ? (
              <div className="notice">
                <span>
                  {t(
                    "Batalkan pesanan ini? Stok akan dikembalikan.",
                    "Cancel this order? Stock will be restored.",
                  )}
                </span>
                <button
                  className="button dark small"
                  onClick={() => {
                    updateOrder(o.id, "cancelled");
                    onClose();
                  }}
                >
                  {t("Ya, batalkan", "Yes, cancel")}
                </button>
                <button onClick={() => setCancel(false)}>
                  {t("Kembali", "Back")}
                </button>
              </div>
            ) : (
              <button className="text-link danger" onClick={() => setCancel(true)}>
                {t("Batalkan pesanan", "Cancel order")}
              </button>
            ))}
          <p className="muted">
            {t(
              `Pesanan & struk (${receiptNo}) tercatat secara resmi dalam sistem ${storeName}.`,
              `Order & receipt (${receiptNo}) officially recorded in the ${storeName} system.`,
            )}
          </p>
        </>
      )}
    </Modal>
  );
}
function ProductsPanel({
  canManageCatalog = true,
}: {
  canManageCatalog?: boolean;
}) {
  const {
    db,
    setDb,
    t,
    priceText,
    notify,
    deleteProduct,
    resetCatalogToExamples,
    clearAllProducts,
  } = useStore();
  const [q, setQ] = useState("");
  const [productView, setProductView] = useState<"table" | "grid">("table");
  const [edit, setEdit] = useState<Item | "new" | null>(null);
  const [archive, setArchive] = useState<Item | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Item | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const list = db.products.filter((p) =>
    `${p.name} ${p.brand} ${p.category} ${p.subCategory || ""}`
      .toLowerCase()
      .includes(q.toLowerCase()),
  );
  const exportJson = () => {
    const blob = new Blob([JSON.stringify(db.products, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "valerieco-catalog.json";
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <>
      <div className="panel">
        <div className="panel-heading">
          <div>
            <h3>
              {t("Katalog produk", "Product catalogue")} ({db.products.length})
            </h3>
          </div>
          {canManageCatalog && (
            <div className="panel-head-actions">
              <button
                className="button outline small"
                onClick={() => setConfirmRestore(true)}
              >
                {t("Sinkronkan Katalog", "Sync Catalogue")}
              </button>
              {db.products.length > 0 && (
                <button
                  className="button outline small"
                  onClick={() => setConfirmClearAll(true)}
                >
                  <Trash2 size={14} />
                  {t("Kosongkan Katalog", "Clear Catalogue")}
                </button>
              )}
              <button
                className="button dark small"
                onClick={() => setEdit("new")}
              >
                <Plus size={16} />
                {t("Tambah produk", "Add product")}
              </button>
            </div>
          )}
        </div>
        {!canManageCatalog && (
          <div className="staff-mode-banner">
            <Package size={15} aria-hidden="true" />
            <span>
              {t(
                "Mode Operasional Staff: Anda dapat memperbarui jumlah stok unit secara langsung. Edit harga & hapus produk dikunci untuk Admin / Super Admin.",
                "Staff Operations Mode: You can adjust available unit stock directly. Pricing, details, and catalogue deletion require Admin / Super Admin access.",
              )}
            </span>
          </div>
        )}
        <div className="table-toolbar" style={{ flexWrap: "wrap", gap: 10 }}>
          <label className="search-input">
            <Search size={16} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("Cari produk, merek, sub-kategori…", "Search products, brand, sub-category…")}
            />
          </label>
          <div className="table-toolbar-actions">
            <div className="view-toggle-pills" role="group">
              <button
                type="button"
                className={productView === "table" ? "active" : ""}
                onClick={() => setProductView("table")}
              >
                {productView === "table" && (
                  <motion.span
                    layoutId="products-view-pill"
                    className="pill-glass-indicator"
                    transition={{ type: "spring", stiffness: 480, damping: 34 }}
                  />
                )}
                <span>{t("Tabel", "Table")}</span>
              </button>
              <button
                type="button"
                className={productView === "grid" ? "active" : ""}
                onClick={() => setProductView("grid")}
              >
                {productView === "grid" && (
                  <motion.span
                    layoutId="products-view-pill"
                    className="pill-glass-indicator"
                    transition={{ type: "spring", stiffness: 480, damping: 34 }}
                  />
                )}
                <LayoutGrid size={14} />
                <span>3D Grid</span>
              </button>
            </div>
            <button
              className="button outline small"
              onClick={exportJson}
            >
              <Download size={15} />
              {t("Ekspor JSON", "Export JSON")}
            </button>
            {canManageCatalog && (
              <label
                className="button outline small"
                style={{ cursor: "pointer", margin: 0 }}
              >
                {t("Impor JSON", "Import JSON")}
                <input
                  type="file"
                  accept="application/json,.json"
                  style={{ display: "none" }}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const parsed = JSON.parse(await file.text());
                      if (!Array.isArray(parsed)) throw new Error("Invalid format");
                      setDb((d) => ({ ...d, products: parsed }));
                      notify(
                        `${parsed.length} produk berhasil diimpor`,
                        `Imported ${parsed.length} products`,
                      );
                    } catch {
                      notify(
                        "Format file JSON katalog tidak valid",
                        "Invalid catalogue JSON file",
                      );
                    }
                    e.target.value = "";
                  }}
                />
              </label>
            )}
            <button
              className="button outline small"
              onClick={() =>
                csvDownload("valerie-products.csv", [
                  [
                    "ID",
                    "Code / SKU",
                    "Brand",
                    "Product",
                    "Category",
                    "SubCategory",
                    "Price USD",
                    "Price IDR",
                    "Stock",
                    "Active",
                  ],
                  ...list.map((p) => [
                    p.id,
                    p.details?.code || p.id.toUpperCase(),
                    p.brand,
                    p.name,
                    p.category,
                    p.subCategory || p.category,
                    p.price,
                    p.priceIdr || "",
                    p.stock,
                    String(p.active),
                  ]),
                ])
              }
            >
              <Download size={15} />
              {t("Ekspor CSV", "Export CSV")}
            </button>
          </div>
        </div>
        {productView === "grid" ? (
          <div className="admin-product-grid">
            {list.map((p) => (
              <motion.article
                layout
                key={p.id}
                className="admin-product-card"
                whileHover={{ y: -4, rotateX: 3, rotateY: -3 }}
              >
                <div className="admin-product-img">
                  <CutoutImg src={p.showcaseImage || p.images[0]} alt={p.name} />
                  <span
                    className={`status ${p.active ? "delivered" : "cancelled"}`}
                  >
                    {p.active ? t("Aktif", "Active") : t("Arsip", "Archived")}
                  </span>
                </div>
                <div className="admin-product-meta">
                  <small>
                    {p.details?.code || p.id.toUpperCase()} · {p.brand}
                  </small>
                  <b>{p.name}</b>
                  <strong>{priceText(p)}</strong>
                </div>
                <div className="admin-product-bottom">
                  <div className="stock-stepper">
                    <button
                      type="button"
                      onClick={() =>
                        setDb((d) => ({
                          ...d,
                          products: d.products.map((x) =>
                            x.id === p.id
                              ? { ...x, stock: Math.max(0, x.stock - 1) }
                              : x,
                          ),
                        }))
                      }
                    >
                      <Minus size={12} />
                    </button>
                    <b>{p.stock}</b>
                    <button
                      type="button"
                      onClick={() =>
                        setDb((d) => ({
                          ...d,
                          products: d.products.map((x) =>
                            x.id === p.id ? { ...x, stock: x.stock + 1 } : x,
                          ),
                        }))
                      }
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                  {canManageCatalog && (
                    <div className="table-actions">
                      <button
                        type="button"
                        className="icon"
                        onClick={() => setEdit(p)}
                        aria-label={t("Edit produk", "Edit product")}
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        type="button"
                        className="icon"
                        onClick={() => setArchive(p)}
                        aria-label={t("Arsipkan produk", "Archive product")}
                      >
                        <Check size={15} />
                      </button>
                      <button
                        type="button"
                        className="icon"
                        onClick={() => setDeleteTarget(p)}
                        aria-label={t("Hapus produk", "Delete product")}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )}
                </div>
              </motion.article>
            ))}
          </div>
        ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{t("Produk", "Product")}</th>
                <th>{t("Kategori", "Category")}</th>
                <th>{t("Harga", "Price")}</th>
                <th>{t("Stok", "Stock")}</th>
                <th>Status</th>
                {canManageCatalog && <th />}
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id}>
                  <td data-label={t("Produk", "Product")}>
                    <div className="table-product">
                      <CutoutImg src={p.showcaseImage || p.images[0]} alt="" />
                      <span>
                        <b>{p.name}</b>
                        <small>
                          {p.details?.code || p.id.toUpperCase()} · {p.brand}
                        </small>
                      </span>
                    </div>
                  </td>
                  <td data-label={t("Kategori", "Category")}>
                    {p.category}
                    {p.subCategory && p.subCategory !== p.category ? (
                      <small style={{ display: "block", opacity: 0.65 }}>
                        {p.subCategory}
                      </small>
                    ) : null}
                  </td>
                  <td data-label={t("Harga", "Price")}>{priceText(p)}</td>
                  <td data-label={t("Stok", "Stock")}>
                    <div className="stock-stepper">
                      <button
                        type="button"
                        aria-label={t("Kurangi stok", "Decrease stock")}
                        onClick={() =>
                          setDb((d) => ({
                            ...d,
                            products: d.products.map((x) =>
                              x.id === p.id
                                ? { ...x, stock: Math.max(0, x.stock - 1) }
                                : x,
                            ),
                          }))
                        }
                      >
                        <Minus size={12} />
                      </button>
                      <b className={p.stock < 10 ? "low-stock" : ""}>
                        {p.stock}
                      </b>
                      <button
                        type="button"
                        aria-label={t("Tambah stok", "Increase stock")}
                        onClick={() =>
                          setDb((d) => ({
                            ...d,
                            products: d.products.map((x) =>
                              x.id === p.id ? { ...x, stock: x.stock + 1 } : x,
                            ),
                          }))
                        }
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  </td>
                  <td data-label="Status">
                    <span
                      className={`status ${p.active ? "delivered" : "cancelled"}`}
                    >
                      {p.active ? t("Aktif", "Active") : t("Arsip", "Archived")}
                    </span>
                  </td>
                  {canManageCatalog && (
                    <td data-label={t("Aksi", "Action")}>
                      <div className="table-actions">
                        <button
                          className="icon"
                          title={t("Edit / ganti produk", "Edit / replace product")}
                          aria-label={t("Edit produk", "Edit product")}
                          onClick={() => setEdit(p)}
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          className="icon"
                          title={
                            p.active
                              ? t("Arsipkan (sembunyikan)", "Archive (hide)")
                              : t("Aktifkan kembali", "Activate")
                          }
                          aria-label={
                            p.active
                              ? t("Arsipkan produk", "Archive product")
                              : t("Aktifkan produk", "Activate product")
                          }
                          onClick={() => setArchive(p)}
                        >
                          <Check size={15} />
                        </button>
                        <button
                          className="icon"
                          title={t("Hapus permanen", "Delete permanently")}
                          aria-label={t("Hapus produk", "Delete product")}
                          onClick={() => setDeleteTarget(p)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
        {!list.length && (
          <Empty
            title={t("Produk tidak ditemukan", "No products found")}
            body={t(
              "Tambahkan produk baru ke dalam katalog toko Anda.",
              "Add a new product to your store catalogue.",
            )}
            action={t("Tambah produk baru", "Add new product")}
            onAction={() => setEdit("new")}
          />
        )}
      </div>
      {edit && (
        <ProductEditor
          product={edit === "new" ? undefined : edit}
          onClose={() => setEdit(null)}
        />
      )}{" "}
      {archive && (
        <Modal
          title={
            archive.active
              ? t("Arsipkan produk?", "Archive this product?")
              : t("Aktifkan produk?", "Activate this product?")
          }
          onClose={() => setArchive(null)}
        >
          <p>
            <b>{archive.brand}</b> — {archive.name}
          </p>
          <p>
            {t(
              "Riwayat pesanan tetap disimpan. Produk arsip disembunyikan dari etalase toko.",
              "Order history is preserved. Archived products are hidden from the storefront.",
            )}
          </p>
          <button
            className="button dark"
            onClick={() => {
              setDb((d) => ({
                ...d,
                products: d.products.map((p) =>
                  p.id === archive.id ? { ...p, active: !p.active } : p,
                ),
              }));
              setArchive(null);
              notify("Status produk diperbarui", "Product status updated");
            }}
          >
            {t("Konfirmasi", "Confirm")}
          </button>
        </Modal>
      )}
      {deleteTarget && (
        <Modal
          title={t("Hapus produk permanen?", "Permanently delete product?")}
          onClose={() => setDeleteTarget(null)}
        >
          <p>
            <b>{deleteTarget.brand}</b> — {deleteTarget.name}
          </p>
          <p>
            {t(
              "Produk ini akan dihapus dari katalog toko secara permanen.",
              "This product will be permanently removed from the store catalogue.",
            )}
          </p>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              className="button dark"
              onClick={() => {
                deleteProduct(deleteTarget.id);
                setDeleteTarget(null);
              }}
            >
              <Trash2 size={15} />
              {t("Ya, hapus permanen", "Yes, delete permanently")}
            </button>
            <button
              className="button outline"
              onClick={() => setDeleteTarget(null)}
            >
              {t("Batal", "Cancel")}
            </button>
          </div>
        </Modal>
      )}
      {confirmClearAll && (
        <Modal
          title={t(
            "Kosongkan seluruh katalog produk?",
            "Clear all catalogue products?",
          )}
          onClose={() => setConfirmClearAll(false)}
        >
          <p>
            {t(
              "Semua produk di katalog saat ini akan dihapus agar Anda dapat menyusun inventaris baru.",
              "All current catalogue products will be removed so you can curate a fresh inventory.",
            )}
          </p>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              className="button dark"
              onClick={() => {
                clearAllProducts();
                setConfirmClearAll(false);
              }}
            >
              <Trash2 size={15} />
              {t("Kosongkan Katalog", "Clear All Products")}
            </button>
            <button
              className="button outline"
              onClick={() => setConfirmClearAll(false)}
            >
              {t("Batal", "Cancel")}
            </button>
          </div>
        </Modal>
      )}
      {confirmRestore && (
        <Modal
          title={t(
            "Sinkronkan ulang katalog utama?",
            "Resync flagship catalogue?",
          )}
          onClose={() => setConfirmRestore(false)}
        >
          <p>
            {t(
              "Ini akan memuat ulang 40 koleksi sepatu utama Valerie & CO ke dalam katalog toko Anda.",
              "This will reload the 40 flagship Valerie & CO footwear pieces into your store catalogue.",
            )}
          </p>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              className="button dark"
              onClick={() => {
                resetCatalogToExamples();
                setConfirmRestore(false);
              }}
            >
              <Check size={15} />
              {t("Sinkronkan Sekarang", "Sync Now")}
            </button>
            <button
              className="button outline"
              onClick={() => setConfirmRestore(false)}
            >
              {t("Batal", "Cancel")}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
function isValidImageSource(s: string) {
  return (
    (s.startsWith("/") && !s.startsWith("//")) ||
    /^https:\/\//i.test(s) ||
    /^data:image\/(png|jpeg|jpg|webp);base64,/i.test(s)
  );
}
function ProductEditor({
  product: p,
  onClose,
}: {
  product?: Item;
  onClose: () => void;
}) {
  const { db, setDb, t, notify } = useStore();
  const [error, setError] = useState("");
  const [categoryState, setCategoryState] = useState<Item["category"]>(
    p?.category || "Sneakers",
  );
  const [productCode, setProductCode] = useState<string>(
    () => p?.details?.code || nextProductCode(db.products, p?.category || "Sneakers"),
  );
  const [codeEdited, setCodeEdited] = useState(Boolean(p?.details?.code));
  const [autoRemoveBg, setAutoRemoveBg] = useState(true);
  const [tolerance, setTolerance] = useState(34);
  const [previewSrc, setPreviewSrc] = useState<string>(
    p?.showcaseImage ||
      p?.images[0] ||
      "/shoes/01_Sneakers/01_velora_blush_chunky/01_velora_blush_chunky.webp",
  );
  const [previewStage, setPreviewStage] = useState<"checker" | "dark" | "light">(
    "checker",
  );
  const rawImageElRef = useRef<HTMLImageElement | null>(null);
  const imagesRef = useRef<HTMLTextAreaElement>(null);
  const showcaseRef = useRef<HTMLInputElement>(null);

  const applyCutoutFromRaw = (
    img: HTMLImageElement,
    removeBgFlag: boolean,
    tol: number,
  ) => {
    const out =
      removeBackgroundFromImageElement(img, {
        removeBg: removeBgFlag,
        tolerance: tol,
        autoTrim: true,
        maxDim: 860,
      }) || img.src;
    setPreviewSrc(out);
    if (imagesRef.current) {
      const lines = imagesRef.current.value
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      const rest = lines.filter(
        (l) =>
          !l.startsWith("data:image/") &&
          l !== "/shoes/01_Sneakers/01_velora_blush_chunky/01_velora_blush_chunky.webp",
      );
      imagesRef.current.value = [out, ...rest].join("\n");
    }
    if (showcaseRef.current) {
      showcaseRef.current.value = out;
    }
  };

  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        rawImageElRef.current = img;
        applyCutoutFromRaw(img, autoRemoveBg, tolerance);
        notify(
          autoRemoveBg
            ? "Foto diunggah & background dihapus otomatis (PNG/WebP transparan)"
            : "Foto produk berhasil diunggah",
          autoRemoveBg
            ? "Photo uploaded & background automatically removed"
            : "Product photo uploaded",
        );
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };
  return (
    <Modal
      title={
        p ? t("Edit produk", "Edit product") : t("Produk baru", "New product")
      }
      onClose={onClose}
      wide
    >
      <form
        className="form-grid"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const images = String(f.get("images"))
            .split("\n")
            .map((x) => x.trim())
            .filter(Boolean);
          if (images.some((x) => !isValidImageSource(x))) {
            setError(
              t(
                "Gambar harus memakai path /, URL https://, atau upload file foto.",
                "Images must use a / path, https:// URL, or uploaded photo file.",
              ),
            );
            return;
          }
          const showcaseImage = String(f.get("showcaseImage") || "").trim();
          if (showcaseImage && !isValidImageSource(showcaseImage)) {
            setError(
              t(
                "Gambar showcase harus memakai path lokal /, URL HTTPS, atau upload file foto.",
                "Showcase artwork must use a local / path, HTTPS URL, or uploaded photo.",
              ),
            );
            return;
          }
          const sizes = String(f.get("sizes")).split(",").map((s) => Number(s.trim()));
          if (sizes.some((n) => !Number.isInteger(n) || n < 20 || n > 55)) {
            setError(
              t(
                "Ukuran harus angka EU (20-55), dipisah koma.",
                "Sizes must be EU numbers (20-55), separated by commas.",
              ),
            );
            return;
          }
          const primaryColor = {
            ...(p?.colors[0] || {}),
            name: p?.colors[0]?.name || "Signature",
            hex: p?.colors[0]?.hex || "#24170f",
            ...(p?.colors[0]?.image ? { image: p.colors[0].image } : {}),
          };
          const subCategoryRaw = String(f.get("subCategory") || "").trim();
          const validSubs = [
            "Boots",
            "Heels",
            "Flatshoes",
            "Espadrilles",
            "Loafers",
            "Monkstraps",
            "Sandals",
            "Sneakers",
          ] as const;
          const subCategory = validSubs.includes(subCategoryRaw as any)
            ? (subCategoryRaw as Item["subCategory"])
            : undefined;
          const name = String(f.get("name")).trim();
          const category = String(f.get("category")) as Item["category"];
          const finalCode =
            String(f.get("productCode") || "").trim().toUpperCase() ||
            nextProductCode(db.products, category);
          const origin =
            String(f.get("origin") || "").trim() ||
            "Crafted in Valerie & CO Atelier";
          const compText = String(f.get("composition") || "").trim();
          const soleText = String(f.get("sole") || "").trim();
          const item: Item = {
            ...(p || {}),
            id: p?.id || buildProductId(name, db.products),
            brand: String(f.get("brand")).trim() || "Valerie & CO",
            name,
            category,
            ...(subCategory ? { subCategory } : {}),
            price: Number(f.get("price")),
            priceIdr: f.get("priceIdr") ? Number(f.get("priceIdr")) : undefined,
            stock: Number(f.get("stock")),
            images,
            showcaseImage: showcaseImage || undefined,
            colors: [primaryColor],
            sizes: [...new Set(sizes)],
            details: {
              code: finalCode,
              origin,
              composition: {
                id: compText || p?.details?.composition?.id || "Kulit Full-Grain Atelier & Lining Halus",
                en: compText || p?.details?.composition?.en || "Full-Grain Atelier Leather & Fine Calf Lining",
              },
              sole: {
                id: soleText || p?.details?.sole?.id || "Sol Jahitan Tangan Valerie & CO",
                en: soleText || p?.details?.sole?.en || "Hand-Stitched Valerie & CO Signature Sole",
              },
            },
            description: {
              id: String(f.get("descId")),
              en: String(f.get("descEn")),
            },
            active: f.get("active") === "on",
            fresh: f.get("fresh") === "on",
          };
          setDb((d) => ({
            ...d,
            products: p
              ? d.products.map((x) => (x.id === p.id ? item : x))
              : [...d.products, item],
          }));
          notify("Produk tersimpan", "Product saved");
          onClose();
        }}
      >
        <label>
          {t("Nama produk", "Product name")}
          <input name="name" required defaultValue={p?.name} />
        </label>
        <label>
          {t("Merek", "Designer")}
          <input
            name="brand"
            required
            defaultValue={p?.brand || "Valerie & CO"}
          />
        </label>
        <label>
          {t("Nomor Produk / SKU (Otomatis)", "Product Number / SKU (Auto)")}
          <input
            name="productCode"
            required
            value={productCode}
            onChange={(e) => {
              setCodeEdited(true);
              setProductCode(e.target.value.toUpperCase());
            }}
          />
          <small>
            {t(
              "Dibuat otomatis untuk struk Midtrans, pelacakan stok & refund.",
              "Auto-assigned for Midtrans receipts, inventory & refund tracking.",
            )}
          </small>
        </label>
        <label>
          {t("Asal / Atelier", "Origin / Atelier")}
          <input
            name="origin"
            defaultValue={p?.details?.origin || "Crafted in Valerie & CO Atelier"}
          />
        </label>
        <label>
          {t("Kategori Utama", "Primary Category")}
          <select
            name="category"
            value={categoryState}
            onChange={(e) => {
              const nextCat = e.target.value as Item["category"];
              setCategoryState(nextCat);
              if (!p && !codeEdited) {
                setProductCode(nextProductCode(db.products, nextCat));
              }
            }}
          >
            <option>Sneakers</option>
            <option>Heels</option>
            <option>Boots</option>
            <option>Flatshoes</option>
          </select>
        </label>
        <label>
          {t("Sub-Kategori (Showcase Filter)", "Sub-Category (Showcase Filter)")}
          <select
            key={p ? p.id : `new-${categoryState}`}
            name="subCategory"
            defaultValue={p?.subCategory || categoryState}
          >
            <option value="Sneakers">Sneakers</option>
            <option value="Boots">Boots</option>
            <option value="Heels">Heels</option>
            <option value="Flatshoes">Flatshoes</option>
            <option value="Loafers">Loafers</option>
            <option value="Monkstraps">Monkstraps</option>
            <option value="Sandals">Sandals</option>
            <option value="Espadrilles">Espadrilles</option>
          </select>
        </label>
        <label>
          {t("Material / Komposisi (opsional)", "Material / Composition (optional)")}
          <input
            name="composition"
            defaultValue={p?.details?.composition?.en || ""}
            placeholder="Full-Grain Atelier Leather"
          />
        </label>
        <label>
          {t("Konstruksi Sol (opsional)", "Sole Construction (optional)")}
          <input
            name="sole"
            defaultValue={p?.details?.sole?.en || ""}
            placeholder="Hand-Stitched Vibram / Leather Sole"
          />
        </label>
        <label>
          {t("Harga USD", "Price USD")}
          <input
            name="price"
            type="number"
            min="0.01"
            step="0.01"
            required
            defaultValue={p?.price}
          />
        </label>
        <label>
          {t("Harga Rupiah (IDR)", "IDR payment price (Midtrans)")}
          <input
            name="priceIdr"
            type="number"
            min="1"
            step="1"
            max="999999999"
            defaultValue={p?.priceIdr}
          />
          <small>
            {t(
              "Ditampilkan saat mode Bahasa Indonesia & digunakan untuk pembayaran Midtrans.",
              "Shown in Indonesian mode & used for fixed-rupiah Midtrans checkout.",
            )}
          </small>
        </label>
        <label>
          {t("Stok total", "Total stock")}
          <input
            name="stock"
            type="number"
            min="0"
            step="1"
            required
            defaultValue={p?.stock ?? 15}
          />
        </label>
        <label className="span-two">
          {t("Ukuran EU (pisahkan koma)", "EU sizes (comma separated)")}
          <input
            name="sizes"
            required
            defaultValue={p?.sizes.join(",") || "38,39,40,41,42,43"}
          />
        </label>
        <div className="span-two studio-cutout-box">
          <div className="studio-cutout-header">
            <div>
              <strong>
                <Sparkles size={14} />
                {t(
                  "Studio Cutout & Auto Remove Background",
                  "Studio Cutout & Auto Background Remover",
                )}
              </strong>
              <small>
                {t(
                  "Upload foto sepatu dari komputer — latar belakang otomatis dihapus menjadi objek 3D transparan.",
                  "Upload any shoe photo from your computer — the background is automatically removed into a transparent 3D cutout.",
                )}
              </small>
            </div>
            <label className="button dark small" style={{ cursor: "pointer", margin: 0 }}>
              <Upload size={14} />
              {t("Pilih Foto & Hapus BG", "Upload Photo & Remove BG")}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          <div className="studio-cutout-body">
            <div className={`studio-cutout-preview stage-${previewStage}`}>
              <CutoutImg src={previewSrc} alt="Preview" />
              <div className="studio-stage-pills">
                <button
                  type="button"
                  className={previewStage === "checker" ? "active" : ""}
                  onClick={() => setPreviewStage("checker")}
                >
                  Grid
                </button>
                <button
                  type="button"
                  className={previewStage === "light" ? "active" : ""}
                  onClick={() => setPreviewStage("light")}
                >
                  {t("Putih", "White")}
                </button>
                <button
                  type="button"
                  className={previewStage === "dark" ? "active" : ""}
                  onClick={() => setPreviewStage("dark")}
                >
                  {t("Coklat", "Espresso")}
                </button>
              </div>
            </div>
            <div className="studio-cutout-controls">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={autoRemoveBg}
                  onChange={(e) => {
                    const next = e.target.checked;
                    setAutoRemoveBg(next);
                    if (rawImageElRef.current) {
                      applyCutoutFromRaw(
                        rawImageElRef.current,
                        next,
                        tolerance,
                      );
                    }
                  }}
                />
                {t(
                  "Hapus background otomatis (Auto Cutout)",
                  "Automatically remove background (Auto Cutout)",
                )}
              </label>
              <label>
                <span>
                  {t("Sensitivitas Cutout", "Cutout Sensitivity")}:{" "}
                  <b>{tolerance}</b>
                </span>
                <input
                  type="range"
                  min={12}
                  max={72}
                  value={tolerance}
                  disabled={!autoRemoveBg}
                  onChange={(e) => {
                    const nextTol = Number(e.target.value);
                    setTolerance(nextTol);
                    if (rawImageElRef.current) {
                      applyCutoutFromRaw(
                        rawImageElRef.current,
                        autoRemoveBg,
                        nextTol,
                      );
                    }
                  }}
                />
              </label>
            </div>
          </div>
        </div>
        <label className="span-two">
          <span>
            {t("URL gambar galeri (satu per baris)", "Gallery image URLs (one per line)")}
          </span>
          <textarea
            ref={imagesRef}
            name="images"
            required
            defaultValue={
              p?.images.join("\n") ||
              "/shoes/01_Sneakers/01_velora_blush_chunky/01_velora_blush_chunky.webp"
            }
            onChange={(e) => {
              const first = e.target.value
                .split("\n")
                .map((s) => s.trim())
                .find(Boolean);
              if (first) setPreviewSrc(first);
            }}
          />
        </label>
        <label className="span-two">
          {t(
            "Gambar khusus 3D showcase (opsional)",
            "3D Showcase artwork (optional)",
          )}
          <input
            ref={showcaseRef}
            name="showcaseImage"
            defaultValue={
              p?.showcaseImage || defaultShowcaseImages[p?.id || ""] || ""
            }
            placeholder="/shoes/02_Boots/03_zavira_espresso_ankle/03_zavira_espresso_ankle.webp"
          />
          <small>
            {t(
              "Gunakan PNG transparan atau foto studio berlatar putih. Jika kosong, foto produk pertama digunakan.",
              "Use a transparent PNG or white-studio photo. If empty, the first product photo is used.",
            )}
          </small>
        </label>
        <label>
          {t("Deskripsi Indonesia", "Indonesian description")}
          <textarea name="descId" required defaultValue={p?.description.id} />
        </label>
        <label>
          {t("Deskripsi Inggris", "English description")}
          <textarea name="descEn" required defaultValue={p?.description.en} />
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            name="active"
            defaultChecked={p?.active ?? true}
          />
          {t("Tampilkan di toko", "Visible in store")}
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            name="fresh"
            defaultChecked={p?.fresh ?? true}
          />
          {t("Tandai produk baru", "Mark as new")}
        </label>
        {error && (
          <p className="error-text span-two" role="alert">
            {error}
          </p>
        )}
        <button className="button dark span-two" type="submit">
          {t("Simpan produk", "Save product")}
          <Check size={16} />
        </button>
      </form>
    </Modal>
  );
}
function RoleSelectControl({
  target,
  callerRole,
  currentUserId,
  superAdminCount,
  onAssign,
  t,
}: {
  target: Member;
  callerRole: UserRole;
  currentUserId?: string;
  superAdminCount: number;
  onAssign: (userId: string, nextRole: UserRole) => Promise<void>;
  t: (id: string, en: string) => string;
}) {
  const [busy, setBusy] = useState(false);
  const current: UserRole =
    target.role === "super_admin" ||
    target.role === "admin" ||
    target.role === "staff"
      ? target.role
      : "member";
  const isSelf = target.id === currentUserId;
  const isCallerSuper = isSuperAdminRole(callerRole);
  const canClaimFirstSuper =
    callerRole === "admin" && superAdminCount === 0 && isSelf;
  const lockedTarget = !isCallerSuper && current === "super_admin";

  return (
    <select
      className="role-select-input"
      aria-label={`${t("Ubah peran untuk", "Change role for")} ${target.name}`}
      value={current}
      disabled={busy || lockedTarget}
      onChange={async (e) => {
        const nextRole = e.target.value as UserRole;
        if (nextRole === current) return;
        setBusy(true);
        try {
          await onAssign(target.id, nextRole);
        } finally {
          setBusy(false);
        }
      }}
    >
      <option value="member" disabled={isSelf && isAdminRole(current)}>
        {t("Member", "Member")}
      </option>
      <option value="staff" disabled={isSelf && isAdminRole(current)}>
        {t("Staff", "Staff")}
      </option>
      <option
        value="admin"
        disabled={(!isCallerSuper && current !== "admin") || (isSelf && current === "super_admin" && superAdminCount <= 1)}
      >
        {t("Admin", "Admin")}
      </option>
      <option
        value="super_admin"
        disabled={!isCallerSuper && !canClaimFirstSuper && current !== "super_admin"}
      >
        {t("Super Admin", "Super Admin")}
      </option>
    </select>
  );
}

function CustomersPanel({
  canManageRoles = true,
  activeStudioRole = "admin",
}: {
  canManageRoles?: boolean;
  activeStudioRole?: UserRole;
}) {
  const {
    db,
    t,
    money,
    serverMode,
    backendUser,
    updateMemberRole,
    notify,
  } = useStore();
  const [q, setQ] = useState("");
  const [customer, setCustomer] = useState<string | null>(null);
  const callerRole: UserRole = serverMode
    ? ((backendUser?.role as UserRole | undefined) || activeStudioRole)
    : activeStudioRole;
  const superAdminCount = db.members.filter(
    (m) => m.role === "super_admin",
  ).length;
  const members = db.members.filter((m) =>
    `${m.name} ${m.email} ${m.role || "member"}`
      .toLowerCase()
      .includes(q.toLowerCase()),
  );
  const handleRoleAssign = async (userId: string, nextRole: UserRole) => {
    try {
      await updateMemberRole(userId, nextRole);
    } catch (err) {
      notify((err as Error).message, (err as Error).message);
    }
  };

  return (
    <div className="panel">
      <div className="panel-heading">
        <h3>
          {t("Member & pelanggan", "Members & customers")} ({db.members.length})
        </h3>
        <button
          className="button outline small"
          onClick={() =>
            csvDownload("valerieco-members.csv", [
              ["Name", "Email", "Phone", "Role", "Orders"],
              ...members.map((m) => [
                m.name,
                m.email,
                m.phone,
                m.role || "member",
                db.orders.filter((o) => o.memberId === m.id).length,
              ]),
            ])
          }
        >
          <Download size={15} />
          {t("Ekspor", "Export")}
        </button>
      </div>
      <div className="table-toolbar">
        <label className="search-input">
          <Search size={16} />
          <input
            placeholder={t("Cari member…", "Search members…")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
      </div>
      {members.length ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{t("Member", "Member")}</th>
                <th>{t("Peran", "Role")}</th>
                <th>Email</th>
                <th>{t("Pesanan", "Orders")}</th>
                <th>{t("Nilai pesanan", "Order value")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id}>
                  <td data-label={t("Member", "Member")}>
                    <div className="customer-name">
                      {m.avatar ? (
                        <img
                          src={m.avatar}
                          alt={m.name}
                          className="avatar avatar-photo"
                        />
                      ) : (
                        <span className="avatar">{m.name[0]}</span>
                      )}
                      <span>{m.name}</span>
                    </div>
                  </td>
                  <td data-label={t("Peran", "Role")}>
                    <RoleBadge role={m.role} t={t} />
                  </td>
                  <td data-label="Email">{m.email}</td>
                  <td data-label={t("Pesanan", "Orders")}>
                    {db.orders.filter((o) => o.memberId === m.id).length}
                  </td>
                  <td
                    data-label={t("Nilai pesanan", "Order value")}
                    className="table-price-cell"
                  >
                    {orderValues(
                      db.orders.filter((o) => o.memberId === m.id),
                      money,
                    )}
                  </td>
                  <td data-label={t("Aksi", "Action")}>
                    <button
                      type="button"
                      className="table-action-pill"
                      onClick={() => setCustomer(m.id)}
                      aria-label={t("Lihat pelanggan", "View customer")}
                    >
                      <span>{t("Detail", "Details")}</span>
                      <ArrowUpRight size={14} aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty
          title={t("Belum ada member", "No members yet")}
          body={t(
            "Profil yang dibuat di area member akan tampil di sini.",
            "Profiles created in the member area will appear here.",
          )}
        />
      )}{" "}
      {customer && (
        <Modal
          title={t("Detail member", "Member details")}
          onClose={() => setCustomer(null)}
        >
          {db.members
            .filter((m) => m.id === customer)
            .map((m) => (
              <div key={m.id} className="story">
                <div className="customer-detail-head">
                  {m.avatar ? (
                    <img
                      src={m.avatar}
                      alt={m.name}
                      className="avatar avatar-photo"
                    />
                  ) : (
                    <span className="avatar">{m.name[0]}</span>
                  )}
                  <div>
                    <div className="dashboard-eyebrow-row">
                      <h3>{m.name}</h3>
                      <RoleBadge role={m.role} t={t} />
                    </div>
                    <div className="verify-chip-row">
                      <span
                        className={`verify-pill ${m.emailVerified ? "ok" : "pending"}`}
                      >
                        Email · {m.emailVerified ? t("Terverifikasi", "Verified") : t("Belum", "Pending")}
                      </span>
                      <span
                        className={`verify-pill ${m.phoneVerified ? "ok" : "pending"}`}
                      >
                        WA · {m.phoneVerified ? t("Terverifikasi", "Verified") : t("Belum", "Pending")}
                      </span>
                    </div>
                  </div>
                </div>
                <p>
                  {m.email}
                  <br />
                  {m.phone || "—"}
                  {m.preferredSize ? ` · EU ${m.preferredSize}` : ""}
                </p>
                {canManageRoles && (
                  <div className="customer-role-editor">
                    <label>
                      <span>{t("Tetapkan Hak Akses Akun", "Assign Account Role")}</span>
                      <RoleSelectControl
                        target={m}
                        callerRole={callerRole}
                        currentUserId={backendUser?.id}
                        superAdminCount={superAdminCount}
                        onAssign={handleRoleAssign}
                        t={t}
                      />
                    </label>
                  </div>
                )}
                <h4>{t("Alamat tersimpan", "Saved addresses")}</h4>
                {m.addresses.map((a) => (
                  <p key={a.id}>
                    {a.label}: {a.street}, {a.city} {a.postal}
                  </p>
                ))}
                {!m.addresses.length && (
                  <p>{t("Belum ada alamat", "No addresses yet")}</p>
                )}
              </div>
            ))}
        </Modal>
      )}
    </div>
  );
}

function TeamPanel({ activeStudioRole }: { activeStudioRole: UserRole }) {
  const { db, t, serverMode, backendUser, updateMemberRole, notify } =
    useStore();
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | UserRole>("all");
  const [elevating, setElevating] = useState(false);

  const callerRole: UserRole = serverMode
    ? ((backendUser?.role as UserRole | undefined) || activeStudioRole)
    : activeStudioRole;
  const superAdminCount = db.members.filter(
    (m) => m.role === "super_admin",
  ).length;
  const canClaimFirstSuper =
    serverMode &&
    backendUser?.role === "admin" &&
    superAdminCount === 0 &&
    !!backendUser?.id;

  const filtered = db.members.filter((m) => {
    const normalized: UserRole =
      m.role === "super_admin" || m.role === "admin" || m.role === "staff"
        ? m.role
        : "member";
    const matchRole = roleFilter === "all" || normalized === roleFilter;
    const matchText = `${m.name} ${m.email} ${m.phone || ""}`
      .toLowerCase()
      .includes(q.toLowerCase());
    return matchRole && matchText;
  });

  const handleAssign = async (userId: string, nextRole: UserRole) => {
    try {
      await updateMemberRole(userId, nextRole);
    } catch (err) {
      notify((err as Error).message, (err as Error).message);
    }
  };

  return (
    <div className="team-layout">
      {canClaimFirstSuper && (
        <div className="panel padded super-claim-banner">
          <div className="super-claim-copy">
            <Crown size={20} aria-hidden="true" />
            <div>
              <strong>
                {t(
                  "Aktifkan Peran Super Admin Pertama",
                  "Activate Founding Super Admin Role",
                )}
              </strong>
              <p>
                {t(
                  "Belum ada akun Super Admin terdaftar. Elevasi akun Anda agar dapat mengelola Admin, Staff, & seluruh otoritas penuh Studio.",
                  "No Super Admin account is active yet. Elevate your account to unlock full Studio governance across Admin, Staff, & Member tiers.",
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="button dark small"
            disabled={elevating}
            onClick={async () => {
              if (!backendUser?.id) return;
              setElevating(true);
              try {
                await updateMemberRole(backendUser.id, "super_admin");
              } catch (err) {
                notify((err as Error).message, (err as Error).message);
              } finally {
                setElevating(false);
              }
            }}
          >
            <Crown size={14} aria-hidden="true" />
            {elevating
              ? t("Memproses…", "Activating…")
              : t("Aktifkan Super Admin", "Activate Super Admin")}
          </button>
        </div>
      )}

      <div className="panel padded">
        <div className="panel-heading">
          <div>
            <h3>{t("Arsitektur Hak Akses 4 Tingkat", "4-Tier Access Architecture")}</h3>
            <p className="panel-subnote">
              {t(
                "Pembagian tanggung jawab antar Super Admin, Admin, Staff, dan Member Valerie & CO.",
                "Structured permissions across Super Admin, Admin, Staff, and Valerie & CO Members.",
              )}
            </p>
          </div>
        </div>
        <div className="team-matrix-grid">
          {ROLE_SPECS.map((spec) => {
            const count = db.members.filter(
              (m) => (m.role || "member") === spec.role,
            ).length;
            const perks = t("id", "en") === "id" ? spec.perksId : spec.perksEn;
            return (
              <article
                className={`team-role-card role-${spec.role}`}
                key={spec.role}
              >
                <div className="team-role-head">
                  <RoleBadge role={spec.role} t={t} />
                  <b>
                    {count} {t("akun", "accounts")}
                  </b>
                </div>
                <p>{t(spec.scopeId, spec.scopeEn)}</p>
                <ul>
                  {perks.map((perk) => (
                    <li key={perk}>
                      <Check size={13} aria-hidden="true" />
                      <span>{perk}</span>
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
      </div>

      <div className="panel">
        <div className="panel-heading">
          <div>
            <h3>{t("Direktori Tim & Akun", "Team & Role Directory")}</h3>
            <p className="panel-subnote">
              {t(
                "Kelola penetapan peran untuk tim operasional dan pelanggan.",
                "Manage role assignments across operational staff and members.",
              )}
            </p>
          </div>
        </div>
        <div className="table-toolbar">
          <label className="search-input">
            <Search size={16} />
            <input
              placeholder={t("Cari nama atau email…", "Search name or email…")}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>
          <select
            aria-label={t("Filter peran", "Filter role")}
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as "all" | UserRole)}
          >
            <option value="all">{t("Semua peran", "All roles")}</option>
            <option value="super_admin">Super Admin</option>
            <option value="admin">Admin</option>
            <option value="staff">Staff</option>
            <option value="member">Member</option>
          </select>
        </div>
        {filtered.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>{t("Akun", "Account")}</th>
                  <th>{t("Verifikasi", "Verification")}</th>
                  <th>{t("Peran", "Role")}</th>
                  <th>{t("Ubah Akses", "Assign Role")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => (
                  <tr key={m.id}>
                    <td data-label={t("Akun", "Account")}>
                      <div className="customer-name">
                        {m.avatar ? (
                          <img
                            src={m.avatar}
                            alt={m.name}
                            className="avatar avatar-photo"
                          />
                        ) : (
                          <span className="avatar">{m.name[0]}</span>
                        )}
                        <div>
                          <b>{m.name}</b>
                          <small>{m.email}</small>
                        </div>
                      </div>
                    </td>
                    <td data-label={t("Verifikasi", "Verification")}>
                      <div className="verify-chip-row">
                        <span
                          className={`verify-pill ${m.emailVerified ? "ok" : "pending"}`}
                        >
                          Email
                        </span>
                        <span
                          className={`verify-pill ${m.phoneVerified ? "ok" : "pending"}`}
                        >
                          WA
                        </span>
                      </div>
                    </td>
                    <td data-label={t("Peran", "Role")}>
                      <RoleBadge role={m.role} t={t} />
                    </td>
                    <td data-label={t("Ubah Akses", "Assign Role")}>
                      <RoleSelectControl
                        target={m}
                        callerRole={callerRole}
                        currentUserId={backendUser?.id}
                        superAdminCount={superAdminCount}
                        onAssign={handleAssign}
                        t={t}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title={t("Akun tidak ditemukan", "No matching accounts")}
            body={t(
              "Coba kata kunci pencarian lain atau ubah filter peran.",
              "Try another search query or reset the role filter.",
            )}
          />
        )}
      </div>
    </div>
  );
}
function CouponsPanel() {
  const { db, setDb, t, notify, deleteCoupon } = useStore();
  return (
    <div className="dashboard-two-col">
      <div className="panel">
        <div className="panel-heading">
          <h3>{t("Kupon aktif & tersimpan", "Saved promotions")}</h3>
        </div>
        {db.coupons.map((c) => (
          <div className="coupon-card" key={c.code}>
            <span className="coupon-icon">
              <Tag />
            </span>
            <div>
              <b>{c.code}</b>
              <small>
                {c.percent}% {t("diskon", "off")}
              </small>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button
                className={`toggle ${c.active ? "on" : ""}`}
                aria-label={`${c.code} ${t("aktif", "enabled")}`}
                aria-pressed={c.active}
                onClick={() =>
                  setDb((d) => ({
                    ...d,
                    coupons: d.coupons.map((x) =>
                      x.code === c.code ? { ...x, active: !x.active } : x,
                    ),
                  }))
                }
              >
                <i />
              </button>
              <button
                className="icon"
                title={t("Hapus kupon", "Delete coupon")}
                aria-label={t("Hapus kupon", "Delete coupon")}
                onClick={() => deleteCoupon(c.code)}
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
        {!db.coupons.length && (
          <Empty
            title={t("Belum ada kupon", "No promotions yet")}
            body={t(
              "Buat kode promo baru di panel sebelah kanan.",
              "Create a new promotion code in the panel on the right.",
            )}
          />
        )}
      </div>
      <div className="panel padded">
        <h3>{t("Buat kode promo", "Create a promotion")}</h3>
        <form
          className="form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const code = String(f.get("code")).trim().toUpperCase();
            if (db.coupons.some((c) => c.code === code)) {
              notify("Kode sudah digunakan", "Code already exists");
              return;
            }
            setDb((d) => ({
              ...d,
              coupons: [
                ...d.coupons,
                { code, percent: Number(f.get("percent")), active: true },
              ],
            }));
            notify("Kupon dibuat", "Promotion created");
            e.currentTarget.reset();
          }}
        >
          <label>
            {t("Kode kupon", "Promotion code")}
            <input
              name="code"
              required
              pattern="[A-Za-z0-9]{3,20}"
              placeholder="VALERIE15"
            />
          </label>
          <label>
            {t("Diskon (%)", "Discount (%)")}
            <input type="number" name="percent" min="1" max="90" required />
          </label>
          <button className="button dark" type="submit">
            <Plus size={16} />
            {t("Buat kupon", "Create code")}
          </button>
        </form>
      </div>
    </div>
  );
}
function SettingsPanel() {
  const { db, setDb, t, notify, serverMode, logout } = useStore();
  return (
    <div className="panel padded settings-panel">
      <span className="eyebrow">STORE IDENTITY</span>
      <h3>
        {t("Identitas toko", "Store identity")}
      </h3>
      <form
        className="form-stack"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          setDb((d) => ({
            ...d,
            settings: {
              ...d.settings,
              homepage: {
                mode: String(f.get("homepageMode")) as "manual" | "bestsellers",
                productIds: f.getAll("homepageProduct").map(String),
              },
              name: String(f.get("name")),
              email: String(f.get("email")),
              announcement: d.settings.announcement,
            },
          }));
          notify("Pengaturan tersimpan", "Settings saved");
        }}
      >
        <div className="form-grid">
          <label>
            {t("Nama toko", "Store name")}
            <input
              name="name"
              maxLength={24}
              required
              defaultValue={db.settings.name}
            />
          </label>
          <label>
            {t("Email bantuan", "Support email")}
            <input
              type="email"
              name="email"
              required
              defaultValue={db.settings.email}
            />
          </label>
        </div>
        <fieldset className="homepage-settings">
          <legend>
            {t("Produk showcase beranda", "Homepage showcase products")}
          </legend>
          <label>
            {t("Sumber produk", "Product source")}
            <select
              name="homepageMode"
              defaultValue={db.settings.homepage?.mode || "bestsellers"}
            >
              <option value="bestsellers">
                {t(
                  "Otomatis — paling banyak dibeli",
                  "Automatic — best sellers",
                )}
              </option>
              <option value="manual">
                {t("Pilihan admin", "Admin selection")}
              </option>
            </select>
          </label>
          <p>
            {t(
              "Mode otomatis mengurutkan produk terlaris; pilih manual untuk menyusun produk unggulan.",
              "Automatic mode ranks best sellers; select manual below to curate featured pieces.",
            )}
          </p>
          <div className="homepage-product-options">
            {db.products.map((p) => (
              <label key={p.id}>
                <input
                  type="checkbox"
                  name="homepageProduct"
                  value={p.id}
                  defaultChecked={
                    db.settings.homepage?.productIds.includes(p.id) || false
                  }
                />
                <img src={p.images[0]} alt="" />
                <span>
                  {p.brand} · {p.name}
                  <small>
                    {p.category} ·{" "}
                    {p.active && p.stock > 0
                      ? t("Tersedia", "Available")
                      : t(
                          "Tidak tampil: arsip / stok kosong",
                          "Hidden: archived / out of stock",
                        )}
                  </small>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="notice">
          {serverMode
            ? t(
                "Sistem toko terintegrasi aktif untuk pengelolaan katalog, pesanan, dan pembayaran.",
                "Integrated store backend active for catalogue management, direct orders, and checkout.",
              )
            : t(
                "Pengaturan toko dan seleksi showcase langsung diterapkan ke storefront Valerie & CO.",
                "Store settings and showcase curation apply directly across the Valerie & CO storefront.",
              )}
        </div>
        <button className="button dark" type="submit">
          {t("Simpan pengaturan", "Save settings")}
          <Check size={16} />
        </button>
      </form>
      {serverMode && (
        <button
          className="text-link danger"
          style={{ marginTop: 25 }}
          onClick={() => void logout()}
        >
          <LogOut size={14} />
          {t("Keluar admin", "Sign out of admin")}
        </button>
      )}
    </div>
  );
}
async function resizeAvatarFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Gagal membaca file foto"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Format foto tidak valid"));
      img.onload = () => {
        const size = 256;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(String(reader.result || ""));
        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
        resolve(canvas.toDataURL("image/jpeg", 0.86));
      };
      img.src = String(reader.result || "");
    };
    reader.readAsDataURL(file);
  });
}

function ProfilePanel() {
  const {
    member,
    saveMember,
    t,
    notify,
    serverMode,
    requestVerification,
    confirmVerification,
  } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [verifying, setVerifying] = useState<"email" | "phone" | null>(null);
  const [otpInput, setOtpInput] = useState("");
  const [localOtp, setLocalOtp] = useState("");
  const [otpBusy, setOtpBusy] = useState(false);

  if (!member) return null;

  const isPlaceholderEmail =
    member.email.endsWith("@wa.valerieco.id") ||
    member.email.endsWith("@member.solere.id") ||
    member.email.endsWith("@wa.solere.local");

  const handleAvatar = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      notify(
        "Pilih file gambar (JPG, PNG, atau WebP).",
        "Please select an image file (JPG, PNG, or WebP).",
      );
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      notify(
        "Ukuran foto maksimal 8 MB.",
        "Maximum photo size is 8 MB.",
      );
      return;
    }
    setUploading(true);
    try {
      const avatar = await resizeAvatarFile(file);
      saveMember({ ...member, avatar });
      notify("Foto profil diperbarui", "Profile photo updated");
    } catch (e) {
      notify((e as Error).message, (e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const startVerify = async (channel: "email" | "phone") => {
    if (channel === "phone" && !member.phone.trim()) {
      notify(
        "Isi dan simpan Nomor WhatsApp terlebih dahulu.",
        "Save your WhatsApp number first.",
      );
      return;
    }
    if (channel === "email" && isPlaceholderEmail) {
      notify(
        "Gunakan alamat email aktif Anda sebelum verifikasi.",
        "Add a real email address before verifying.",
      );
      return;
    }
    setOtpInput("");
    setOtpBusy(true);
    try {
      if (serverMode) {
        const res = await requestVerification(channel);
        setLocalOtp(res.previewCode || "");
        setVerifying(channel);
        notify(
          res.sent
            ? channel === "phone"
              ? "Kode OTP 6 digit telah dikirim ke WhatsApp Anda"
              : "Kode OTP 6 digit telah dikirim ke email Anda"
            : "Kode OTP verifikasi siap dimasukkan",
          res.sent
            ? channel === "phone"
              ? "A 6-digit verification code was sent to your WhatsApp"
              : "A 6-digit verification code was sent to your email"
            : "Enter your 6-digit verification code",
        );
      } else {
        const buf = new Uint32Array(1);
        crypto.getRandomValues(buf);
        const generated = String(100000 + (buf[0] % 900000));
        setLocalOtp(generated);
        setVerifying(channel);
      }
    } catch (e) {
      notify((e as Error).message, (e as Error).message);
    } finally {
      setOtpBusy(false);
    }
  };

  const submitVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifying) return;
    const cleaned = otpInput.trim().replace(/\s+/g, "");
    if (!cleaned) return;
    setOtpBusy(true);
    try {
      if (serverMode) {
        await confirmVerification(verifying, cleaned);
      } else {
        if (cleaned !== localOtp) {
          notify("Kode verifikasi tidak cocok", "Invalid verification code");
          setOtpBusy(false);
          return;
        }
        saveMember({
          ...member,
          ...(verifying === "email"
            ? { emailVerified: true }
            : { phoneVerified: true }),
        });
      }
      notify(
        verifying === "email"
          ? "Email berhasil diverifikasi"
          : "Nomor WhatsApp berhasil diverifikasi",
        verifying === "email"
          ? "Email verified successfully"
          : "WhatsApp number verified successfully",
      );
      setVerifying(null);
      setOtpInput("");
      setLocalOtp("");
    } catch (err) {
      notify((err as Error).message, (err as Error).message);
    } finally {
      setOtpBusy(false);
    }
  };

  return (
    <div className="panel padded settings-panel profile-panel-card">
      <div className="profile-heading">
        <div className="avatar-upload-box">
          {member.avatar ? (
            <img
              src={member.avatar}
              alt={member.name}
              className="avatar large avatar-photo"
            />
          ) : (
            <span className="avatar large">{member.name[0]}</span>
          )}
          <button
            type="button"
            className="avatar-cam-btn"
            onClick={() => fileRef.current?.click()}
            aria-label={t("Ubah foto profil", "Change profile photo")}
            disabled={uploading}
          >
            <Camera size={14} />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              void handleAvatar(f);
            }}
          />
        </div>
        <div className="profile-meta">
          <h3>{member.name}</h3>
          <p className="profile-identity-sub">
            {!isPlaceholderEmail && member.email
              ? member.email
              : member.phone ||
                t("Anggota Valerie & CO Atelier", "Valerie & CO Atelier Member")}
          </p>
          <div className="verify-chip-row" style={{ marginTop: 4 }}>
            <span className={`verify-pill ${member.emailVerified ? "ok" : "pending"}`}>
              <Mail size={12} />
              Email ·{" "}
              {member.emailVerified
                ? t("Terverifikasi", "Verified")
                : t("Belum Verif", "Unverified")}
            </span>
            <span className={`verify-pill ${member.phoneVerified ? "ok" : "pending"}`}>
              <Smartphone size={12} />
              WhatsApp ·{" "}
              {member.phoneVerified
                ? t("Terverifikasi", "Verified")
                : t("Belum Verif", "Unverified")}
            </span>
          </div>
          <div className="profile-photo-actions">
            <button
              type="button"
              className="button outline small"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              <Upload size={13} />
              {uploading
                ? t("Memproses…", "Processing…")
                : t("Ganti Foto", "Change Photo")}
            </button>
            {member.avatar && (
              <button
                type="button"
                className="button outline small danger-outline"
                onClick={() => saveMember({ ...member, avatar: "" })}
              >
                <Trash2 size={13} />
                {t("Hapus Foto", "Remove")}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="profile-verify-card">
        <div>
          <strong>{t("Verifikasi Email & WhatsApp", "Email & WhatsApp Verification")}</strong>
          <small>
            {t(
              "Pastikan email dan nomor WhatsApp aktif untuk notifikasi pengiriman & keamanan akun.",
              "Keep your email and WhatsApp verified for instant shipping updates and account recovery.",
            )}
          </small>
        </div>
        <div className="profile-verify-actions">
          {!member.emailVerified && (
            <button
              type="button"
              className="button outline small"
              disabled={otpBusy || isPlaceholderEmail}
              onClick={() => void startVerify("email")}
            >
              <Mail size={13} />
              {t("Verifikasi Email", "Verify Email")}
            </button>
          )}
          {!member.phoneVerified && (
            <button
              type="button"
              className="button outline small"
              disabled={otpBusy || !member.phone.trim()}
              onClick={() => void startVerify("phone")}
            >
              <Smartphone size={13} />
              {t("Verifikasi WhatsApp", "Verify WhatsApp")}
            </button>
          )}
          {member.emailVerified && member.phoneVerified && (
            <span className="verify-pill ok">
              <CheckCircle2 size={13} />
              {t("Kontak Lengkap Terverifikasi", "All Contacts Verified")}
            </span>
          )}
        </div>
        <AnimatePresence initial={false}>
          {verifying && (
            <motion.form
              className="profile-otp-box"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              onSubmit={submitVerifyCode}
            >
              <div className="profile-otp-head">
                <span>
                  {verifying === "email"
                    ? t(`Masukkan kode verifikasi Email (${member.email})`, `Enter Email OTP (${member.email})`)
                    : t(`Masukkan kode verifikasi WhatsApp (${member.phone})`, `Enter WhatsApp OTP (${member.phone})`)}
                </span>
                {localOtp && (
                  <small className="otp-preview-code">
                    {t("Kode OTP:", "Code:")} <b>{localOtp}</b>
                  </small>
                )}
              </div>
              <div className="inline-input-btn">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value)}
                  placeholder="6 digit OTP"
                />
                <button
                  type="submit"
                  className="button dark small"
                  disabled={otpBusy}
                >
                  {t("Konfirmasi", "Confirm")}
                </button>
                <button
                  type="button"
                  className="button outline small"
                  onClick={() => setVerifying(null)}
                >
                  {t("Batal", "Cancel")}
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </div>

      <form
        className="form-stack"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const prefSize = Number(f.get("preferredSize"));
          const nextEmail = !serverMode && isPlaceholderEmail
            ? String(f.get("email") || member.email).trim().toLowerCase()
            : member.email;
          saveMember({
            ...member,
            email: nextEmail,
            emailVerified:
              nextEmail !== member.email ? false : member.emailVerified,
            name: String(f.get("name")),
            phone: String(f.get("phone")),
            bio: String(f.get("bio") || "").trim().slice(0, 240),
            preferredSize:
              Number.isInteger(prefSize) && prefSize >= 35 && prefSize <= 46
                ? prefSize
                : undefined,
          });
        }}
      >
        <div className="form-grid">
          <label>
            {t("Nama lengkap", "Full name")}
            <input
              name="name"
              required
              minLength={2}
              defaultValue={member.name}
            />
          </label>
          <label>
            {t("Nomor WhatsApp", "WhatsApp number")}
            <input
              type="tel"
              name="phone"
              placeholder="+62 812 ..."
              defaultValue={member.phone}
            />
          </label>
        </div>
        <div className="form-grid">
          <label>
            Email
            <input
              type="email"
              name="email"
              defaultValue={isPlaceholderEmail ? "" : member.email}
              placeholder="nama@email.com"
              readOnly={serverMode || !isPlaceholderEmail}
            />
          </label>
          <label>
            {t("Ukuran sepatu favorit (EU)", "Preferred EU shoe size")}
            <select
              name="preferredSize"
              defaultValue={member.preferredSize || 39}
            >
              {[36, 37, 38, 39, 40, 41, 42, 43, 44, 45].map((s) => (
                <option key={s} value={s}>
                  EU {s}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          {t("Catatan gaya & preferensi", "Style note & fit preference")}
          <textarea
            name="bio"
            rows={2}
            maxLength={240}
            placeholder={t(
              "Suede hangat netral, EU 39 untuk heels dan EU 40 untuk boots.",
              "Warm neutral suede, EU 39 for heels and EU 40 for boots.",
            )}
            defaultValue={member.bio || ""}
          />
        </label>
        <div className="profile-submit-row">
          <button className="button dark" type="submit">
            {t("Simpan Perubahan", "Save Profile")}
            <Check size={16} />
          </button>
          <p className="muted profile-save-note">
            {serverMode
              ? t(
                  "Tersimpan di server & database.",
                  "Saved securely on the server.",
                )
              : t(
                  "Tersimpan lokal di browser.",
                  "Saved locally in this browser.",
                )}
          </p>
        </div>
      </form>
    </div>
  );
}

function MemberSettingsPanel({
  lang,
  setLang,
  saveMember,
}: {
  lang: "id" | "en";
  setLang: (l: "id" | "en") => void;
  saveMember: (m: import("./store").Member) => void;
}) {
  const { member, t, serverMode, notify, logout } = useStore();
  if (!member) return null;
  const sec = member.security || {};
  const prefs = member.preferences || {};
  const score =
    40 +
    (sec.twoFactorEnabled ? 30 : 0) +
    (sec.loginAlerts !== false ? 15 : 0) +
    (sec.recoveryEmail ? 15 : 0);

  const updateSecurity = (patch: Partial<NonNullable<typeof member.security>>) => {
    saveMember({
      ...member,
      security: {
        twoFactorEnabled: sec.twoFactorEnabled ?? false,
        loginAlerts: sec.loginAlerts ?? true,
        sessionTimeout: sec.sessionTimeout || "7d",
        recoveryEmail: sec.recoveryEmail || "",
        lastPasswordChange: sec.lastPasswordChange || "",
        ...patch,
      },
    });
  };

  return (
    <div className="security-layout">
      <div className="panel padded security-score-card">
        <div className="security-score-head">
          <div className="security-shield-badge">
            <ShieldCheck size={24} />
          </div>
          <div>
            <span className="eyebrow">
              {t("STATUS KEAMANAN AKUN", "ACCOUNT SECURITY STATUS")}
            </span>
            <h3>
              {score >= 85
                ? t("Akun Terlindungi Optimal", "Optimal Protection Active")
                : t("Tingkatkan Keamanan Akun Anda", "Strengthen Your Account Security")}
            </h3>
            <p>
              {t(
                `Skor perlindungan ${score}% · Email ${member.email} terverifikasi`,
                `Protection score ${score}% · Verified ${member.email}`,
              )}
            </p>
          </div>
          <strong className="security-percent">{score}%</strong>
        </div>
        <div className="security-bar">
          <motion.span
            initial={{ width: 0 }}
            animate={{ width: `${score}%` }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
      </div>

      <div className="panel padded settings-panel">
        <div className="panel-heading">
          <h3>
            <Lock size={16} />{" "}
            {t("Proteksi Login & Sesi", "Login & Session Protection")}
          </h3>
        </div>
        <div className="security-rows">
          <div className="security-row">
            <div>
              <strong>
                <KeyRound size={15} />{" "}
                {t("Verifikasi Dua Langkah (2FA)", "Two-Factor Verification (2FA)")}
              </strong>
              <small>
                {t("Konfirmasi ekstra saat login baru.", "Extra check on new logins.")}
              </small>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={!!sec.twoFactorEnabled}
              className={`toggle ${sec.twoFactorEnabled ? "on" : ""}`}
              onClick={() =>
                updateSecurity({ twoFactorEnabled: !sec.twoFactorEnabled })
              }
            >
              <i />
            </button>
          </div>

          <div className="security-row">
            <div>
              <strong>
                <Bell size={15} />{" "}
                {t("Peringatan Aktivitas Login", "New Login Alerts")}
              </strong>
              <small>
                {t("Notifikasi perangkat baru.", "Alert on unfamiliar devices.")}
              </small>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={sec.loginAlerts !== false}
              className={`toggle ${sec.loginAlerts !== false ? "on" : ""}`}
              onClick={() =>
                updateSecurity({ loginAlerts: sec.loginAlerts === false })
              }
            >
              <i />
            </button>
          </div>

          <div className="security-row">
            <div>
              <strong>
                <Smartphone size={15} />{" "}
                {t("Batas Durasi Sesi", "Session Timeout")}
              </strong>
              <small>
                {t("Durasi aktif sesi login.", "Active session duration.")}
              </small>
            </div>
            <select
              aria-label={t("Batas durasi sesi", "Session timeout")}
              value={sec.sessionTimeout || "7d"}
              onChange={(e) =>
                updateSecurity({
                  sessionTimeout: e.target.value as "7d" | "24h" | "strict",
                })
              }
            >
              <option value="7d">{t("7 Hari", "7 Days")}</option>
              <option value="24h">{t("24 Jam", "24 Hours")}</option>
              <option value="strict">{t("Ketat (1 Sesi)", "Strict (Single)")}</option>
            </select>
          </div>
        </div>

        <form
          className="form-stack"
          style={{ marginTop: 18 }}
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            updateSecurity({
              recoveryEmail: String(f.get("recoveryEmail") || "").trim(),
            });
          }}
        >
          <label>
            {t("Email Pemulihan Cadangan", "Backup Recovery Email")}
            <div className="inline-input-btn">
              <input
                type="email"
                name="recoveryEmail"
                placeholder="backup@domain.com"
                defaultValue={sec.recoveryEmail || ""}
              />
              <button type="submit" className="button outline">
                {t("Simpan", "Save")}
              </button>
            </div>
          </label>
        </form>
      </div>

      <div className="panel padded settings-panel">
        <div className="panel-heading">
          <h3>
            <Shield size={16} />{" "}
            {t("Kata Sandi Akun", "Account Password")}
          </h3>
          {sec.lastPasswordChange && (
            <span className="status">
              {t("Diperbarui", "Updated")}{" "}
              {new Date(sec.lastPasswordChange).toLocaleDateString()}
            </span>
          )}
        </div>
        {serverMode ? (
          <PasswordForm
            passwordless={member.hasPassword === false}
            onChanged={() =>
              updateSecurity({ lastPasswordChange: new Date().toISOString() })
            }
          />
        ) : (
          <div className="notice" style={{ marginTop: 14 }}>
            {t(
              "Pembaruan kata sandi tersedia saat layanan akun aktif terhubung.",
              "Password rotation unlocks automatically when server account sync is connected.",
            )}
          </div>
        )}
      </div>

      <div className="panel padded settings-panel">
        <div className="panel-heading">
          <h3>
            <Globe size={16} />{" "}
            {t("Preferensi Aplikasi & Privasi", "App & Notification Preferences")}
          </h3>
        </div>
        <div className="security-rows">
          <div className="security-row">
            <div>
              <strong>{t("Bahasa Tampilan", "Display Language")}</strong>
              <small>
                {t("Pilih bahasa antarmuka toko.", "Choose storefront interface language.")}
              </small>
            </div>
            <div className="chart-tabs" role="group">
              <button
                type="button"
                className={lang === "id" ? "active" : ""}
                onClick={() => {
                  setLang("id");
                  notify("Bahasa diubah ke Indonesia", "Language set to Indonesian");
                }}
              >
                ID
              </button>
              <button
                type="button"
                className={lang === "en" ? "active" : ""}
                onClick={() => {
                  setLang("en");
                  notify("Language switched to English", "Language switched to English");
                }}
              >
                EN
              </button>
            </div>
          </div>

          <div className="security-row">
            <div>
              <strong>{t("Pembaruan Status Pesanan", "Order Status Notifications")}</strong>
              <small>
                {t("Info pengiriman dan resi otomatis.", "Shipment updates and tracking alerts.")}
              </small>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={prefs.orderAlerts !== false}
              className={`toggle ${prefs.orderAlerts !== false ? "on" : ""}`}
              onClick={() =>
                saveMember({
                  ...member,
                  preferences: {
                    ...prefs,
                    orderAlerts: prefs.orderAlerts === false,
                  },
                })
              }
            >
              <i />
            </button>
          </div>

          <div className="security-row">
            <div>
              <strong>{t("Kabar Rilis & Eksklusif", "Private Release Updates")}</strong>
              <small>
                {t("Akses awal untuk rilis sepatu terbaru Valerie & CO.", "Early access for new Valerie & CO drops.")}
              </small>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={!!prefs.promoEmails}
              className={`toggle ${prefs.promoEmails ? "on" : ""}`}
              onClick={() =>
                saveMember({
                  ...member,
                  preferences: {
                    ...prefs,
                    promoEmails: !prefs.promoEmails,
                  },
                })
              }
            >
              <i />
            </button>
          </div>
        </div>

        <div className="security-footer-actions">
          <div className="active-session-pill">
            <span className="live-dot" />
            <span>
              {t("Perangkat ini · Sesi aktif sekarang", "This device · Current active session")}
            </span>
          </div>
          <button
            type="button"
            className="button outline danger-outline"
            onClick={() => void logout()}
          >
            <LogOut size={15} />
            {t("Keluar dari Perangkat Ini", "Sign Out of This Device")}
          </button>
        </div>
      </div>
    </div>
  );
}
function AddressesPanel() {
  const { member, saveMember, t } = useStore();
  const [edit, setEdit] = useState<Address | "new" | null>(null);
  const [remove, setRemove] = useState<string | null>(null);
  if (!member) return null;
  return (
    <>
      <div className="panel padded addresses-panel-shell">
        <div className="panel-heading">
          <h3>{t("Alamat tersimpan", "Your saved addresses")}</h3>
          <button className="button dark small" onClick={() => setEdit("new")}>
            <Plus size={16} />
            {t("Tambah alamat", "Add address")}
          </button>
        </div>
        {member.addresses.length ? (
          <div className="address-grid">
            {member.addresses.map((a) => (
              <article className="address-card" key={a.id}>
                <div>
                  <MapPin size={22} />
                  <span>{a.label}</span>
                </div>
                <h3>{a.name}</h3>
                <p>
                  {a.street}
                  <br />
                  {a.city}, {a.postal}
                </p>
                <p>{a.phone}</p>
                <div className="address-actions">
                  <button className="text-link" onClick={() => setEdit(a)}>
                    <Pencil size={14} />
                    {t("Edit", "Edit")}
                  </button>
                  <button
                    className="text-link danger"
                    onClick={() => setRemove(a.id)}
                  >
                    <Trash2 size={14} />
                    {t("Hapus", "Remove")}
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <Empty
            title={t("Ke mana langkah berikutnya?", "Where to next?")}
            body={t(
              "Tambahkan alamat untuk mempercepat checkout.",
              "Add an address for a smoother checkout.",
            )}
            action={t("Tambah alamat", "Add address")}
            onAction={() => setEdit("new")}
          />
        )}
      </div>
      {edit && (
        <Modal
          title={
            edit === "new"
              ? t("Alamat baru", "New address")
              : t("Edit alamat", "Edit address")
          }
          onClose={() => setEdit(null)}
        >
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const a: Address = {
                id: edit === "new" ? crypto.randomUUID() : edit.id,
                label: String(f.get("label")),
                name: String(f.get("name")),
                phone: String(f.get("phone")),
                street: String(f.get("street")),
                city: String(f.get("city")),
                postal: String(f.get("postal")),
              };
              saveMember({
                ...member,
                addresses:
                  edit === "new"
                    ? [...member.addresses, a]
                    : member.addresses.map((x) => (x.id === a.id ? a : x)),
              });
              setEdit(null);
            }}
          >
            <label>
              {t("Label alamat", "Address label")}
              <input
                name="label"
                required
                placeholder={t("Rumah / Kantor", "Home / Office")}
                defaultValue={edit === "new" ? "" : edit.label}
              />
            </label>
            <AddressFields
              name={member.name}
              phone={member.phone}
              address={edit === "new" ? undefined : edit}
            />
            <button className="button dark" type="submit">
              {t("Simpan alamat", "Save address")}
            </button>
          </form>
        </Modal>
      )}
      {remove && (
        <Modal
          title={t("Hapus alamat?", "Remove address?")}
          onClose={() => setRemove(null)}
        >
          <p>
            {t(
              "Alamat pada pesanan sebelumnya tetap tersimpan.",
              "Addresses on past orders remain unchanged.",
            )}
          </p>
          <button
            className="button dark"
            onClick={() => {
              saveMember({
                ...member,
                addresses: member.addresses.filter((a) => a.id !== remove),
              });
              setRemove(null);
            }}
          >
            {t("Hapus alamat", "Remove address")}
          </button>
        </Modal>
      )}
    </>
  );
}
function SupportPanel({ admin }: { admin: boolean }) {
  const { db, setDb, t, member, notify } = useStore();
  const [compose, setCompose] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const tickets = admin
    ? db.tickets
    : db.tickets.filter((x) => x.memberId === member?.id);
  const ticket = tickets.find((x) => x.id === selected);
  return (
    <>
      <div className="panel">
        <div className="panel-heading">
          <div>
            <h3>
              {admin
                ? t("Kotak masuk pelanggan", "Customer inbox")
                : t("Kami siap membantu", "A little personal assistance")}
            </h3>
            <p>{db.settings.email}</p>
          </div>
          {!admin && (
            <button
              className="button dark small"
              onClick={() => setCompose(true)}
            >
              <Plus size={16} />
              {t("Pesan baru", "New request")}
            </button>
          )}
        </div>
        {tickets.length ? (
          <div className="ticket-list">
            {tickets.map((x) => (
              <button key={x.id} onClick={() => setSelected(x.id)}>
                <span className="ticket-icon">
                  <MessageSquare size={20} />
                </span>
                <span>
                  <b>{x.subject}</b>
                  <small>{x.message.slice(0, 90)}</small>
                </span>
                <span
                  className={`status ${x.status === "open" ? "processing" : "delivered"}`}
                >
                  {x.status === "open"
                    ? t("Terbuka", "Open")
                    : t("Selesai", "Resolved")}
                </span>
                <ChevronRight size={16} />
              </button>
            ))}
          </div>
        ) : (
          <Empty
            title={t("Belum ada pesan", "No messages yet")}
            body={
              admin
                ? t(
                    "Permintaan bantuan member akan tampil di sini.",
                    "Member support requests will appear here.",
                  )
                : t(
                    "Punya pertanyaan tentang pesanan atau koleksi? Kirim pesan kepada kami.",
                    "A question about an order or a piece? Send us a note.",
                  )
            }
          />
        )}
      </div>
      {compose && member && (
        <Modal
          title={t("Pesan untuk Valerie & CO", "A note to Valerie & CO")}
          onClose={() => setCompose(false)}
        >
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const x: Ticket = {
                id: crypto.randomUUID(),
                memberId: member.id,
                subject: String(f.get("subject")),
                message: String(f.get("message")),
                reply: "",
                status: "open",
                date: new Date().toISOString(),
              };
              setDb((d) => ({ ...d, tickets: [x, ...d.tickets] }));
              setCompose(false);
              notify(
                "Pesan tersimpan untuk admin",
                "Message saved for the admin",
              );
            }}
          >
            <label>
              {t("Subjek", "Subject")}
              <input name="subject" required />
            </label>
            <label>
              {t("Pesan Anda", "Your message")}
              <textarea name="message" required rows={5} />
            </label>
            <button className="button dark" type="submit">
              {t("Kirim pesan", "Send request")}
              <ArrowRight size={16} />
            </button>
          </form>
        </Modal>
      )}
      {ticket && (
        <Modal title={ticket.subject} onClose={() => setSelected(null)}>
          <div className="message-bubble">
            <span className="eyebrow">
              {t("PESAN MEMBER", "MEMBER MESSAGE")}
            </span>
            <p>{ticket.message}</p>
            <small>{new Date(ticket.date).toLocaleString()}</small>
          </div>
          {ticket.reply && (
            <div className="message-bubble reply">
              <span className="eyebrow">VALERIE & CO CLIENT CARE</span>
              <p>{ticket.reply}</p>
            </div>
          )}
          {admin && (
            <form
              className="form-stack"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                setDb((d) => ({
                  ...d,
                  tickets: d.tickets.map((x) =>
                    x.id === ticket.id
                      ? {
                          ...x,
                          reply: String(f.get("reply")),
                          status: f.get("closed") === "on" ? "closed" : "open",
                        }
                      : x,
                  ),
                }));
                notify("Balasan tersimpan", "Reply saved");
                setSelected(null);
              }}
            >
              <label>
                {t("Balasan", "Reply")}
                <textarea name="reply" required defaultValue={ticket.reply} />
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="closed"
                  defaultChecked={ticket.status === "closed"}
                />
                {t("Tandai selesai", "Mark as resolved")}
              </label>
              <button className="button dark" type="submit">
                {t("Simpan balasan", "Save reply")}
              </button>
            </form>
          )}
        </Modal>
      )}
    </>
  );
}

function toLocalYmd(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function RealtimeClockCalendar({
  orders,
  lang,
  t,
  money,
  onSelectOrder,
}: {
  orders: Order[];
  lang: "id" | "en";
  t: (id: string, en: string) => string;
  money: (n: number, c?: "USD" | "IDR") => string;
  onSelectOrder: (id: string) => void;
}) {
  const [now, setNow] = useState(() => new Date());
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedYmd, setSelectedYmd] = useState(() => toLocalYmd(new Date()));

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const locale = lang === "id" ? "id-ID" : "en-US";
  const dateLabel = now.toLocaleDateString(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const timeLabel = now.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const ordersByYmd = new Map<string, Order[]>();
  for (const o of orders) {
    const d = new Date(o.date);
    if (Number.isNaN(d.getTime())) continue;
    const key = toLocalYmd(d);
    const list = ordersByYmd.get(key) || [];
    list.push(o);
    ordersByYmd.set(key, list);
  }

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const firstDayWeek = (new Date(year, month, 1).getDay() + 6) % 7; // Monday = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayYmd = toLocalYmd(now);
  const dayNames =
    lang === "id"
      ? ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"]
      : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const cells: Array<{ day: number; ymd: string; count: number } | null> = [];
  for (let i = 0; i < firstDayWeek; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    const ymd = toLocalYmd(new Date(year, month, day));
    cells.push({
      day,
      ymd,
      count: ordersByYmd.get(ymd)?.length || 0,
    });
  }

  const selectedOrders = ordersByYmd.get(selectedYmd) || [];

  return (
    <div className="realtime-clock-wrap">
      <button
        type="button"
        className={`realtime-clock-btn ${open ? "active" : ""}`}
        onClick={() => setOpen((v) => !v)}
        title={t(
          "Buka Kalender & Waktu Real-Time",
          "Open Calendar & Real-Time Clock",
        )}
      >
        <Calendar size={14} />
        <span className="realtime-clock-date">{dateLabel}</span>
        <span className="realtime-clock-sep">·</span>
        <Clock size={13} />
        <strong className="realtime-clock-time">{timeLabel} WIB</strong>
      </button>

      {open && (
        <div
          className="calendar-popover"
          role="dialog"
          aria-label={t(
            "Kalender & Agenda Transaksi",
            "Transaction Calendar & Agenda",
          )}
        >
          <div className="calendar-popover-head">
            <div>
              <span className="eyebrow">
                {t("WAKTU REALTIME & KALENDER", "REAL-TIME CLOCK & CALENDAR")}
              </span>
              <h4>
                {viewMonth.toLocaleDateString(locale, {
                  month: "long",
                  year: "numeric",
                })}
              </h4>
            </div>
            <div className="calendar-nav-btns">
              <button
                type="button"
                className="calendar-nav-btn"
                aria-label={t("Bulan sebelumnya", "Previous month")}
                onClick={() =>
                  setViewMonth(new Date(year, month - 1, 1))
                }
              >
                <ChevronLeft size={15} />
              </button>
              <button
                type="button"
                className="calendar-today-btn"
                onClick={() => {
                  const current = new Date();
                  setViewMonth(
                    new Date(current.getFullYear(), current.getMonth(), 1),
                  );
                  setSelectedYmd(toLocalYmd(current));
                }}
              >
                {t("Hari Ini", "Today")}
              </button>
              <button
                type="button"
                className="calendar-nav-btn"
                aria-label={t("Bulan berikutnya", "Next month")}
                onClick={() =>
                  setViewMonth(new Date(year, month + 1, 1))
                }
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>

          <div className="calendar-weekdays">
            {dayNames.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>

          <div className="calendar-grid">
            {cells.map((cell, idx) =>
              cell ? (
                <button
                  key={cell.ymd}
                  type="button"
                  className={`calendar-day ${cell.ymd === todayYmd ? "today" : ""} ${cell.ymd === selectedYmd ? "selected" : ""} ${cell.count > 0 ? "has-orders" : ""}`}
                  onClick={() => setSelectedYmd(cell.ymd)}
                >
                  <span>{cell.day}</span>
                  {cell.count > 0 && (
                    <small className="calendar-day-badge">{cell.count}</small>
                  )}
                </button>
              ) : (
                <span key={`empty-${idx}`} className="calendar-day empty" />
              ),
            )}
          </div>

          <div className="calendar-agenda">
            <div className="calendar-agenda-head">
              <strong>
                {t("Agenda Transaksi", "Transaction Agenda")} · {selectedYmd}
              </strong>
              <span>
                {selectedOrders.length} {t("pesanan", "orders")}
              </span>
            </div>
            {selectedOrders.length > 0 ? (
              <div className="calendar-agenda-list">
                {selectedOrders.slice(0, 4).map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    className="calendar-agenda-item"
                    onClick={() => {
                      onSelectOrder(o.id);
                      setOpen(false);
                    }}
                  >
                    <div>
                      <b>
                        {o.id} ·{" "}
                        {o.receiptNumber ||
                          `VCO-INV-${o.id.replace(/^SOL-/, "").slice(0, 8)}`}
                      </b>
                      <small>
                        {o.name} ·{" "}
                        {new Date(o.date).toLocaleTimeString("id-ID", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}{" "}
                        WIB
                      </small>
                    </div>
                    <strong>{money(o.total, o.currency || "IDR")}</strong>
                  </button>
                ))}
              </div>
            ) : (
              <p className="calendar-agenda-empty">
                {t(
                  "Belum ada pesanan pada tanggal ini. Pilih tanggal bertanda angka untuk membuka struk transaksi.",
                  "No orders on this date. Select a badged date to inspect transaction receipts.",
                )}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StudioClaimBox({
  memberName,
  memberEmail,
  onClaim,
  onLogout,
  t,
}: {
  memberName: string;
  memberEmail: string;
  onClaim: (data: { setupToken: string; role?: UserRole }) => Promise<void>;
  onLogout: () => void;
  t: (id: string, en: string) => string;
}) {
  const [token, setToken] = useState("");
  const [role, setRole] = useState<UserRole>("super_admin");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  return (
    <div className="studio-claim-box">
      <div className="studio-claim-head">
        <div>
          <strong>{memberName}</strong>
          <small>{memberEmail}</small>
        </div>
        <RoleBadge role="member" t={t} />
      </div>
      <p className="studio-claim-desc">
        {t(
          "Aktifkan hak akses Studio langsung untuk akun yang sedang login menggunakan Kode Aktivasi Studio (SOLERE_SETUP_TOKEN):",
          "Activate Studio permissions directly for your signed-in account using your Studio Activation Token (SOLERE_SETUP_TOKEN):",
        )}
      </p>
      <form
        className="studio-claim-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!token.trim()) return;
          setBusy(true);
          setErr("");
          try {
            await onClaim({ setupToken: token.trim(), role });
            setToken("");
          } catch (error) {
            const msg = (error as Error).message.toLowerCase();
            setErr(
              msg.includes("invalid setup token")
                ? t(
                    "Kode aktivasi Studio tidak valid. Periksa SOLERE_SETUP_TOKEN Anda.",
                    "Invalid Studio activation token. Check your SOLERE_SETUP_TOKEN.",
                  )
                : (error as Error).message,
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="studio-claim-row">
          <select
            aria-label={t("Pilih peran studio", "Select studio role")}
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
          >
            <option value="super_admin">Super Admin</option>
            <option value="admin">Admin</option>
            <option value="staff">Staff</option>
          </select>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder={t(
              "Kode aktivasi Studio (SOLERE_SETUP_TOKEN)",
              "Studio activation token",
            )}
            required
          />
        </div>
        {err && (
          <p role="alert" className="error-text" style={{ margin: 0 }}>
            {err}
          </p>
        )}
        <div className="studio-claim-actions">
          <button
            type="submit"
            className="button dark small"
            disabled={busy || !token.trim()}
          >
            <ShieldCheck size={14} />
            {busy
              ? t("Mengaktifkan…", "Activating…")
              : t("Aktifkan Akses Studio", "Activate Studio Access")}
          </button>
          <button
            type="button"
            className="studio-signout-btn"
            onClick={onLogout}
          >
            <LogOut size={14} strokeWidth={1.7} aria-hidden="true" />
            <span>{t("Keluar akun", "Sign out")}</span>
          </button>
        </div>
      </form>
    </div>
  );
}

function PasswordForm({
  onChanged,
  passwordless = false,
}: {
  onChanged?: () => void;
  passwordless?: boolean;
}) {
  const { t, notify } = useStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const strength =
    (newPwd.length >= 8 ? 1 : 0) +
    (/[A-Z]/.test(newPwd) && /[a-z]/.test(newPwd) ? 1 : 0) +
    (/\d/.test(newPwd) ? 1 : 0) +
    (/[^A-Za-z0-9]/.test(newPwd) ? 1 : 0);
  const strengthLabel =
    strength >= 4
      ? t("Sangat Kuat", "Very Strong")
      : strength >= 3
        ? t("Kuat", "Strong")
        : strength >= 2
          ? t("Cukup", "Moderate")
          : t("Minimal 8 karakter", "Min 8 characters");
  return (
    <form
      className="form-stack"
      style={{ marginTop: 18 }}
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const f = new FormData(form);
        if (f.get("password") !== f.get("confirm")) {
          setError(
            t(
              "Konfirmasi kata sandi tidak cocok.",
              "Passwords do not match.",
            ),
          );
          return;
        }
        setBusy(true);
        setError("");
        try {
          await api("auth/password", {
            current: passwordless ? "" : String(f.get("current") || ""),
            password: String(f.get("password")),
          });
          onChanged?.();
          notify(
            "Kata sandi diperbarui. Sesi perangkat lain telah dikeluarkan.",
            "Password updated. Other sessions have been signed out.",
          );
          setNewPwd("");
          form.reset();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      {!passwordless && (
        <label>
          {t("Kata sandi saat ini", "Current password")}
          <input
            name="current"
            type={showPwd ? "text" : "password"}
            autoComplete="current-password"
            required
          />
        </label>
      )}
      <label>
        {t("Kata sandi baru", "New password")}
        <div className="pwd-input-wrap">
          <input
            name="password"
            type={showPwd ? "text" : "password"}
            minLength={8}
            maxLength={256}
            autoComplete="new-password"
            value={newPwd}
            onChange={(e) => setNewPwd(e.target.value)}
            required
          />
          <button
            type="button"
            className="pwd-eye-btn"
            onClick={() => setShowPwd((v) => !v)}
            aria-label={t("Tampilkan sandi", "Toggle password visibility")}
          >
            {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
        {newPwd.length > 0 && (
          <div className="pwd-strength-row">
            <div className="pwd-strength-bars">
              {[1, 2, 3, 4].map((lv) => (
                <i
                  key={lv}
                  className={strength >= lv ? `lv-${strength}` : ""}
                />
              ))}
            </div>
            <small>{strengthLabel}</small>
          </div>
        )}
      </label>
      <label>
        {t("Ulangi kata sandi baru", "Confirm new password")}
        <input
          name="confirm"
          type={showPwd ? "text" : "password"}
          minLength={8}
          maxLength={256}
          autoComplete="new-password"
          required
        />
      </label>
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      <button className="button dark" disabled={busy}>
        {t("Perbarui Kata Sandi", "Update Password")}
      </button>
    </form>
  );
}

function escHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] || c);
}

function downloadReceiptHtml(
  o: Order,
  receiptNo: string,
  storeName: string,
  lang: "id" | "en",
  money: (n: number, currency?: "USD" | "IDR") => string,
) {
  const subtotal = o.items.reduce((n, i) => n + i.price * i.quantity, 0);
  const orderCurrency = o.currency || "USD";
  const rows = o.items
    .map(
      (i) =>
        `<tr><td><strong>${escHtml(i.name)}</strong><br><small>${escHtml(i.productCode || i.productId.toUpperCase())}</small></td><td>EU ${i.size}</td><td>${i.quantity}</td><td>${escHtml(money(i.price, orderCurrency))}</td><td>${escHtml(money(i.price * i.quantity, orderCurrency))}</td></tr>`,
    )
    .join("");
  const refundBlock = o.refund
    ? `<div style="margin-top:16px;padding:12px 14px;border:1px solid #c9a7a2;background:#fdf6f5;border-radius:8px;"><strong>${lang === "id" ? "CATATAN REFUND" : "REFUND RECORD"} (${escHtml(o.refund.status.toUpperCase())})</strong><br>${escHtml(money(o.refund.amount, o.refund.currency || orderCurrency))}${o.refund.reference ? ` · Ref: ${escHtml(o.refund.reference)}` : ""}<br>${escHtml(o.refund.reason)}</div>`
    : "";
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escHtml(receiptNo)} — ${escHtml(storeName)}</title><style>body{font-family:system-ui,-apple-system,sans-serif;color:#1b1612;margin:32px auto;max-width:720px;padding:0 16px;line-height:1.5}header{display:flex;justify-content:space-between;border-bottom:2px solid #1b1612;padding-bottom:14px;margin-bottom:18px}table{width:100%;border-collapse:collapse;margin:18px 0}th,td{padding:10px 8px;border-bottom:1px solid #e5ded6;text-align:left}th:last-child,td:last-child{text-align:right}.totals{margin-left:auto;max-width:280px}.totals div{display:flex;justify-content:space-between;padding:4px 0}.grand{border-top:2px solid #1b1612;margin-top:6px;padding-top:8px;font-weight:700;font-size:1.1em}</style></head><body><header><div><small>${escHtml(storeName.toUpperCase())}</small><h1 style="margin:4px 0">${lang === "id" ? "Struk Pembelian Resmi" : "Official Receipt"}</h1></div><div style="text-align:right"><strong>${escHtml(receiptNo)}</strong><br>${escHtml(o.id)}<br><small>${escHtml(new Date(o.date).toLocaleString())}</small></div></header><p><strong>${escHtml(o.address.name || o.name)}</strong> (${escHtml(o.email)})<br>${escHtml(o.address.street)}, ${escHtml(o.address.city)} ${escHtml(o.address.postal)} · ${escHtml(o.address.phone)}</p><p>Pembayaran / Payment: <strong>${o.payment ? `Midtrans (${escHtml(o.payment.method || "QRIS / VA")})` : "Direct Checkout"}</strong> · Status: <strong>${escHtml((o.payment?.status || o.status).toUpperCase())}</strong></p><table><thead><tr><th>Item &amp; SKU</th><th>Varian</th><th>Qty</th><th>Harga</th><th>Subtotal</th></tr></thead><tbody>${rows}</tbody></table><div class="totals"><div><span>Subtotal</span><span>${escHtml(money(subtotal, orderCurrency))}</span></div><div><span>Discount</span><span>-${escHtml(money(o.discount, orderCurrency))}</span></div><div><span>Shipping</span><span>${escHtml(money(o.shipping, orderCurrency))}</span></div><div class="grand"><span>Total</span><span>${escHtml(money(o.total, orderCurrency))}</span></div></div>${refundBlock}<p style="margin-top:28px;font-size:12px;color:#6c6259">${escHtml(storeName)} · ${lang === "id" ? "Dokumen sah bukti pembelian & acuan refund." : "Official proof of purchase & refund reference."}</p></body></html>`;
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `Struk-${receiptNo}.html`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function orderValues(
  orders: Order[],
  money: (n: number, currency?: "USD" | "IDR") => string,
) {
  return (["USD", "IDR"] as const)
    .map((currency) =>
      money(
        orders
          .filter(
            (o) =>
              o.status !== "cancelled" &&
              o.refund?.status !== "refunded" &&
              (o.currency || "USD") === currency &&
              (!o.payment || o.payment.status === "paid"),
          )
          .reduce((n, o) => n + o.total, 0),
        currency,
      ),
    )
    .join(" / ");
}

function PaymentPanel({ order }: { order: Order }) {
  const { t, refresh, money, notify } = useStore();
  const [busy, setBusy] = useState(false);
  const [showInlineGateway, setShowInlineGateway] = useState(
    order.payment?.status === "pending",
  );
  return (
    <div className="notice payment-panel">
      <div style={{ width: "100%" }}>
        <b>
          Payment Gateway · {money(order.total, order.currency || "IDR")}
          {order.payment?.method ? ` · ${order.payment.method.toUpperCase()}` : ""}
        </b>
        <p>
          {t("Status pembayaran", "Payment status")}:{" "}
          <b>{order.payment?.status?.toUpperCase()}</b>
          {order.payment?.transactionId && ` · Tx: ${order.payment.transactionId}`}
          {order.payment?.paidAt &&
            ` · ${t("Lunas", "Paid")}: ${new Date(order.payment.paidAt).toLocaleString()}`}
          {order.payment?.refundedAt &&
            ` · Refunded: ${new Date(order.payment.refundedAt).toLocaleString()}`}
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
          {order.payment?.status === "pending" && (
            <button
              type="button"
              className="button dark small"
              onClick={() => setShowInlineGateway((v) => !v)}
            >
              {showInlineGateway
                ? t("Tutup Panel Pembayaran", "Hide Payment Panel")
                : t(
                    "Bayar Sekarang di Halaman Ini (QRIS / VA / Kartu)",
                    "Pay Now Inline (QRIS / VA / Card)",
                  )}
            </button>
          )}
          <button
            type="button"
            className="button small"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api("payments/status", { id: order.id });
                await refresh();
              } catch (e) {
                notify((e as Error).message, (e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {t("Periksa status pembayaran", "Check payment status")}
          </button>
        </div>
        {showInlineGateway && order.payment?.status === "pending" && (
          <div style={{ marginTop: 16 }}>
            <InlinePaymentAndReceipt
              order={order}
              startInPaymentStage={true}
              checkingRemote={busy}
              onCheckRemoteStatus={async () => {
                setBusy(true);
                try {
                  await api("payments/status", { id: order.id });
                  await refresh();
                } finally {
                  setBusy(false);
                }
              }}
              onDone={() => setShowInlineGateway(false)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

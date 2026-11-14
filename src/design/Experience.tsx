import { useState, useEffect, lazy, Suspense } from "react";
import {
  motion,
  AnimatePresence,
  LayoutGroup,
  useReducedMotion,
} from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Search,
  ShoppingBag,
  Heart,
  User,
  LayoutGrid,
  Plus,
  Minus,
  Truck,
  ShieldCheck,
  Headphones,
  RefreshCw,
  Home,
  Check,
  Globe,
} from "lucide-react";
import { useStore, isStudioRole } from "./store";
import { itemPrice, SHIPPING_RATES } from "./commerce";
import { categoryCopy, type Item } from "./catalog";
import { Modal, Empty } from "./ui";
import { Bag, Checkout, MemberEntry } from "./Shopping";
import { Showcase } from "./Showcase";
import { showcaseImage } from "./showcase-data";
import { CutoutImg } from "./bg-remove";
import { PaymentPartnersStrip } from "./PaymentLogos";
const Dashboard = lazy(() => import("./Dashboard"));
type View = "home" | "shop" | "wishlist" | "member" | "admin" | "detail";

/** Interleave active footwear across core silhouettes so curated grids stay varied. */
function pickCurated(items: Item[], category: string, limit = 8): Item[] {
  if (category !== "All") {
    return items.filter((p) => p.category === category).slice(0, limit);
  }
  const order = ["Boots", "Heels", "Sneakers", "Flatshoes"];
  const picked: Item[] = [];
  const seen = new Set<string>();
  for (let round = 0; picked.length < limit && round < limit; round += 1) {
    let added = false;
    for (const cat of order) {
      const match = items.filter((p) => p.category === cat)[round];
      if (match && !seen.has(match.id) && picked.length < limit) {
        seen.add(match.id);
        picked.push(match);
        added = true;
      }
    }
    if (!added) break;
  }
  for (const p of items) {
    if (picked.length >= limit) break;
    if (!seen.has(p.id)) {
      seen.add(p.id);
      picked.push(p);
    }
  }
  return picked;
}

export function Experience() {
  const s = useStore();
  const { db, t, lang, setLang, currency, money, priceText, member, backendUser, serverMode } = s;
  const reduced = useReducedMotion();
  const [view, setView] = useState<View>(() =>
    location.hash.startsWith("#product/")
      ? "detail"
      : location.hash === "#admin"
        ? "admin"
        : location.hash === "#member"
          ? "member"
          : location.hash === "#shop" || location.hash === "#categories"
            ? "shop"
            : location.hash === "#wishlist"
              ? "wishlist"
              : "home",
  );
  const [category, setCategory] = useState("All");
  const [homeCat, setHomeCat] = useState("All");
  const [selected, setSelected] = useState<string | null>(() =>
    location.hash.startsWith("#product/")
      ? decodeURIComponent(location.hash.slice(9))
      : null,
  );
  const [overlay, setOverlay] = useState<
    "search" | "bag" | "checkout" | "entry" | "about" | null
  >(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("featured");
  const products = db.products.filter((p) => p.active);
  const current = products.find((p) => p.id === selected);
  const go = (v: View) => {
    setQuery("");
    setView(v);
    location.hash = v;
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  useEffect(() => {
    const handler = () => {
      const v = location.hash.slice(1);
      window.scrollTo({ top: 0, behavior: "instant" });
      if (!v || v === "home") {
        setView("home");
        return;
      }
      if (v === "about") {
        setView("home");
        setOverlay("about");
        return;
      }
      if (v.startsWith("product/")) {
        setSelected(decodeURIComponent(v.slice(8)));
        setView("detail");
        return;
      }
      if (v === "categories") {
        setView("shop");
        return;
      }
      if (
        ["home", "shop", "wishlist", "member", "admin"].includes(v)
      )
        setView(v as View);
    };
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
    const brandName = db.settings.name || "Valerie & CO";
    const pageTitles: Record<View, string> = {
      home: `${brandName} — ${t("Koleksi Alas Kaki Kurasi", "Curated Footwear")}`,
      shop: `${t("Koleksi", "Collection")} — ${brandName}`,
      wishlist: `${t("Favorit Saya", "Wishlist")} — ${brandName}`,
      member: `${t("Area Member", "Member Space")} — ${brandName}`,
      admin: `${t("Studio Admin", "Admin Studio")} — ${brandName}`,
      detail: current ? `${current.name} — ${brandName}` : `${t("Detail Produk", "Product Detail")} — ${brandName}`,
    };
    document.title = pageTitles[view];
  }, [lang, view, current, db.settings.name, t]);
  const detail = (p: Item) => {
    setSelected(p.id);
    setQuery("");
    setOverlay(null);
    setView("detail");
    location.hash = "product/" + encodeURIComponent(p.id);
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const shop = (cat = "All", nextSort = "featured") => {
    setCategory(cat);
    setSort(nextSort);
    setQuery("");
    go("shop");
  };
  const filtered = products
    .filter((p) => category === "All" || p.category === category)
    .sort((a, b) =>
      sort === "low"
        ? itemPrice(a, currency) - itemPrice(b, currency)
        : sort === "high"
          ? itemPrice(b, currency) - itemPrice(a, currency)
          : sort === "new"
            ? Number(b.fresh) - Number(a.fresh)
            : 0,
    );
  const bagCount = db.bag.reduce((n, l) => n + l.quantity, 0);
  const language = (
    <button
      className="language"
      onClick={() => setLang(lang === "id" ? "en" : "id")}
      aria-label={t("Ganti bahasa ke Inggris", "Switch language to Indonesian")}
    >
      <Globe size={14} />
      {lang.toUpperCase()}
    </button>
  );
  if (s.serverMode && !s.ready) {
    if (s.backendError) {
      return (
        <div className="empty">
          <h2>Valerie & CO</h2>
          <p>{s.backendError}</p>
          <button className="button dark" onClick={() => void s.refresh()}>
            {t("Coba lagi", "Try again")}
          </button>
        </div>
      );
    }
    return (
      <StoreSkeleton
        view={view}
        brandName={db.settings.name || "Valerie & CO"}
        label={t("Memuat koleksi Valerie & CO", "Loading Valerie & CO")}
      />
    );
  }
  return (
    <div className={`solere-app ${view === "home" ? "reference-home" : ""}`}>
      <a className="skip-link" href="#main-content">
        {t("Langsung ke konten", "Skip to content")}
      </a>
      <header className="reference-header">
        <nav
          className="reference-nav"
          aria-label={t("Navigasi utama", "Primary navigation")}
        >
          <div className="reference-nav-group reference-nav-left">
            <button
              className={`reference-nav-link ${view === "home" ? "active-nav" : ""}`}
              aria-current={view === "home" ? "page" : undefined}
              onClick={() => go("home")}
            >
              {t("BERANDA", "HOME")}
            </button>
            <button
              className={`reference-nav-link ${view === "shop" && sort !== "new" ? "active-nav" : ""}`}
              aria-current={view === "shop" && sort !== "new" ? "page" : undefined}
              onClick={() => shop()}
            >
              {t("KOLEKSI", "COLLECTION")}
            </button>
          </div>
          <button
            className={`reference-wordmark ${view === "home" ? "active-wordmark" : ""}`}
            aria-label={db.settings.name}
            onClick={() => go("home")}
          >
            {db.settings.name}
          </button>
          <div className="reference-nav-group reference-nav-right">
            <button
              className={`reference-nav-link ${view === "shop" && sort === "new" ? "active-nav" : ""}`}
              aria-current={view === "shop" && sort === "new" ? "page" : undefined}
              onClick={() => shop("All", "new")}
            >
              {t("TERBARU", "NEW IN")}
            </button>
            <button
              className={`reference-nav-link ${overlay === "about" ? "active-nav" : ""}`}
              onClick={() => setOverlay("about")}
            >
              {t("ATELIER", "ATELIER")}
            </button>
          </div>
        </nav>
        <div className="reference-actions">
          <div className="reference-action-icons">
            <button
              className="icon"
              aria-label={t("Cari produk", "Search products")}
              onClick={() => setOverlay("search")}
            >
              <Search size={16} aria-hidden="true" />
            </button>
            <button
              className={`icon ${view === "wishlist" ? "active-icon" : ""}`}
              aria-label={t("Favorit", "Wishlist")}
              aria-current={view === "wishlist" ? "page" : undefined}
              onClick={() => go("wishlist")}
            >
              <Heart size={16} aria-hidden="true" />
              <span className="count">{db.favorites.length || ""}</span>
            </button>
            <button
              className={`icon ${view === "member" ? "active-icon" : ""}`}
              aria-label={t("Akun member", "Member account")}
              aria-current={view === "member" ? "page" : undefined}
              onClick={() => go("member")}
            >
              <User size={16} aria-hidden="true" />
            </button>
            <button
              className="icon"
              aria-label={t("Tas belanja", "Shopping bag")}
              onClick={() => setOverlay("bag")}
            >
              <ShoppingBag size={16} aria-hidden="true" />
              <span className="count">{bagCount || ""}</span>
            </button>
          </div>
          <span className="reference-actions-sep" aria-hidden="true" />
          <div className="reference-action-utils">
            {language}
            <button
              type="button"
              className={`studio-quick-link ${view === "admin" ? "active" : ""}`}
              aria-current={view === "admin" ? "page" : undefined}
              onClick={() => go("admin")}
              title={t(
                "Valerie & CO Studio Admin",
                "Valerie & CO Studio Admin",
              )}
            >
              STUDIO
            </button>
          </div>
        </div>
      </header>
      <header className="site-header">
        <button className="wordmark" onClick={() => go("home")}>
          {db.settings.name}
          <small>CURATED FOOTWEAR</small>
        </button>
        <div className="header-actions">
          {language}
          <button
            className="icon"
            aria-label={t("Cari produk", "Search products")}
            onClick={() => setOverlay("search")}
          >
            <Search />
          </button>
          <button
            className="icon desktop-only"
            aria-label={t("Favorit", "Wishlist")}
            onClick={() => go("wishlist")}
          >
            <Heart />
            <span className="count">{db.favorites.length || ""}</span>
          </button>
          <button
            className="icon desktop-only"
            aria-label={t("Akun saya", "My account")}
            onClick={() => go("member")}
          >
            <User />
          </button>
          <button
            className="icon"
            aria-label={t("Tas belanja", "Shopping bag")}
            onClick={() => setOverlay("bag")}
          >
            <ShoppingBag />
            <span className="count">{bagCount || ""}</span>
          </button>
        </div>
      </header>
      <main
        key={view}
        className="page-transition"
        id="main-content"
        tabIndex={-1}
      >
        {view === "home" && (
          <>
            <MobileHome onShop={shop} />
            <Showcase
              onOpenBag={() => setOverlay("bag")}
              renderDetail={(p, close) => (
                <ProductDetail
                  key={p.id}
                  product={p}
                  back={close}
                  openBag={() => {
                    close();
                    setOverlay("bag");
                  }}
                />
              )}
            />
            <button
              type="button"
              className="editorial-divider"
              onClick={() =>
                document
                  .getElementById("curated-section")
                  ?.scrollIntoView({ behavior: reduced ? "auto" : "smooth" })
              }
            >
              <span>VALERIE & CO SELECTION / 2026</span>
              <span>
                {t(
                  "Dipilih dengan karakter. Dikenakan dengan percaya diri.",
                  "Chosen with character. Worn with confidence.",
                )}
              </span>
              <ArrowDown />
            </button>
            <section className="section curated-section" id="curated-section">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">
                    {t("DIPILIH DENGAN CERMAT", "CURATED, NOT COMPLICATED")}
                  </span>
                  <h2>{t("Pilihan istimewa.", "Objects of desire.")}</h2>
                </div>
                <button className="text-link" onClick={() => shop(homeCat)}>
                  {t("Lihat semua", "View all")}
                  <ArrowUpRight size={16} />
                </button>
              </div>
              <div className="curated-filter-pills" role="tablist" aria-label={t("Filter pilihan rumah", "Curated filter")}>
                {["All", "Sneakers", "Heels", "Boots", "Flatshoes"].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    role="tab"
                    aria-selected={homeCat === cat}
                    className={homeCat === cat ? "active" : ""}
                    onClick={() => setHomeCat(cat)}
                  >
                    {categoryCopy[cat][lang]}
                  </button>
                ))}
              </div>
              <div className="product-grid">
                {pickCurated(products, homeCat, 8).map((p) => (
                    <ProductCard
                      key={p.id}
                      product={p}
                      onSelect={() => detail(p)}
                    />
                  ))}
              </div>
            </section>
            <motion.section
              className="campaign section"
              style={{ transformPerspective: 1200 }}
              initial={reduced ? false : { opacity: 0, y: 30, rotateX: 5 }}
              whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
              viewport={{ once: true, amount: 0.05 }}
              transition={{ duration: reduced ? 0 : 0.6, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="campaign-copy">
                <span className="eyebrow">
                  {t("SENI TAMPIL BERBEDA", "THE ART OF STANDING OUT")}
                </span>
                <h2>
                  {t(
                    "Bukan sekadar\nlangkah biasa.",
                    "Anything but\nordinary.",
                  )}
                </h2>
                <p>
                  {t(
                    "Siluet berani. Detail yang berarti. Koleksi sepatu untuk mengekspresikan diri Anda.",
                    "Bold silhouettes. Considered details. A footwear edit that feels unmistakably you.",
                  )}
                </p>
                <button className="button light" onClick={() => shop()}>
                  {t("Jelajahi koleksi", "Explore the collection")}
                  <ArrowUpRight size={16} />
                </button>
              </div>
              <motion.button
                type="button"
                className="campaign-image"
                whileHover={reduced ? undefined : { scale: 1.012 }}
                whileTap={reduced ? undefined : { scale: 0.99 }}
                transition={{ type: "spring", stiffness: 280, damping: 24 }}
                onClick={() => {
                  const featured =
                    products.find((p) => p.id === "vco-zavira-espresso-ankle") ||
                    products[0];
                  if (featured) detail(featured);
                }}
              >
                <span>{t("01 / EDISI ATELIER 2026", "01 / THE 2026 ATELIER EDIT")}</span>
                <CutoutImg
                  src="/shoes/02_Boots/03_zavira_espresso_ankle/03_zavira_espresso_ankle.webp"
                  alt="Valerie & CO Zavira Espresso Ankle Boot"
                  loading="lazy"
                />
                <span className="campaign-caption">
                  {t("Lihat Detail", "View Piece")}
                  <ArrowUpRight size={15} />
                </span>
              </motion.button>
            </motion.section>
            <Benefits
              onOpenAbout={() => setOverlay("about")}
              onShop={() => shop()}
              onCare={() => go("member")}
            />
            <Newsletter />
          </>
        )}
        {view === "shop" && (
          <section className="section catalog-page">
            <div className="breadcrumb">
              <button onClick={() => go("home")}>{t("Beranda", "Home")}</button>
              <span>/</span>
              {t("Koleksi", "Collection")}
            </div>
            <div className="section-heading">
              <div>
                <span className="eyebrow">
                  {t("PILIHAN VALERIE & CO", "THE VALERIE & CO EDIT")}
                </span>
                <h1>{t("Koleksi pilihan.", "The considered collection.")}</h1>
              </div>
              <span>
                {filtered.length} {t("produk pilihan", "curated pieces")}
              </span>
            </div>
            <div className="catalog-controls">
              <div className="tabs">
                {["All", "Sneakers", "Heels", "Boots", "Flatshoes"].map((cat) => (
                  <button
                    key={cat}
                    className={category === cat ? "active" : ""}
                    onClick={() => setCategory(cat)}
                  >
                    {categoryCopy[cat][lang]}
                  </button>
                ))}
              </div>
              <div className="filter-selects">
                <label>
                  <label className="sort-label" htmlFor="shop-sort-select">{t("Urutkan", "Sort")}</label>
                  <select
                    id="shop-sort-select"
                    name="sort"
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                  >
                    <option value="featured">
                      {t("Pilihan kami", "Our selection")}
                    </option>
                    <option value="new">{t("Terbaru", "Newest")}</option>
                    <option value="low">
                      {t("Harga terendah", "Price: low to high")}
                    </option>
                    <option value="high">
                      {t("Harga tertinggi", "Price: high to low")}
                    </option>
                  </select>
                </label>
              </div>
            </div>
            {filtered.length ? (
              <div className="product-grid">
                {filtered.map((p) => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    onSelect={() => detail(p)}
                  />
                ))}
              </div>
            ) : (
              <Empty
                title={t("Belum ada yang cocok", "No matching pieces")}
                body={t(
                  "Coba filter kategori lainnya.",
                  "Try another category filter.",
                )}
                action={t("Reset filter", "Clear filters")}
                onAction={() => {
                  setCategory("All");
                  setQuery("");
                }}
              />
            )}
          </section>
        )}
        {view === "detail" && !current && (
          <Empty
            title={t("Produk tidak tersedia", "Product unavailable")}
            body={t(
              "Produk ini mungkin sudah diarsipkan.",
              "This product may have been archived.",
            )}
            action={t("Kembali ke koleksi", "Back to collection")}
            onAction={() => shop()}
          />
        )}
        {view === "detail" && current && (
          <ProductDetail
            key={current.id}
            product={current}
            back={() => shop()}
            openBag={() => setOverlay("bag")}
          />
        )}
        {view === "wishlist" && (
          <section className="section catalog-page">
            <div className="section-heading">
              <div>
                <span className="eyebrow">
                  {t("KOLEKSI PERSONAL ANDA", "YOUR PERSONAL EDIT")}
                </span>
                <h1>{t("Favorit Anda.", "Saved for you.")}</h1>
              </div>
              <span>
                {db.favorites.length} {t("tersimpan", "saved pieces")}
              </span>
            </div>
            {products.filter((p) => db.favorites.includes(p.id)).length ? (
              <div className="product-grid">
                {products
                  .filter((p) => db.favorites.includes(p.id))
                  .map((p) => (
                    <ProductCard
                      key={p.id}
                      product={p}
                      onSelect={() => detail(p)}
                    />
                  ))}
              </div>
            ) : (
              <Empty
                title={t(
                  "Ruang untuk favorit Anda",
                  "A space for your favourites",
                )}
                body={t(
                  "Sentuh ikon hati untuk menyimpan koleksi pilihan.",
                  "Tap the heart on any piece to make it part of your edit.",
                )}
                action={t("Jelajahi koleksi", "Explore the collection")}
                onAction={() => shop()}
              />
            )}
          </section>
        )}
        {(view === "member" || view === "admin") && (
          <Suspense
            fallback={
              <StoreSkeleton
                view={view}
                embedded
                brandName={db.settings.name || "Valerie & CO"}
                label={t("Memuat halaman akun", "Loading account page")}
              />
            }
          >
            <Dashboard
              key={view}
              mode={view}
              onShop={() => shop()}
              onWishlist={() => go("wishlist")}
              onEntry={() => setOverlay("entry")}
              onSelect={detail}
            />
          </Suspense>
        )}
      </main>
      {view !== "admin" && view !== "member" && (
        <footer className="footer">
          <div className="footer-top">
            <div>
              <button className="wordmark" onClick={() => go("home")}>
                {db.settings.name}
              </button>
              <p>
                {t(
                  "Pilihan istimewa. Gaya yang personal.",
                  "Considered pieces. A personal point of view.",
                )}
                <br />
                {t(
                  "Temukan langkah Anda bersama kami.",
                  "Find your own stride with us.",
                )}
              </p>
            </div>
            <div>
              <h4>{t("Koleksi", "Discover")}</h4>
              <button onClick={() => shop("Sneakers")}>Sneakers</button>
              <button onClick={() => shop("Heels")}>Heels</button>
              <button onClick={() => shop("Boots")}>Boots</button>
              <button onClick={() => shop("Flatshoes")}>Flatshoes</button>
            </div>
            <div>
              <h4>{t("Bantuan", "Client care")}</h4>
              <button onClick={() => go("member")}>
                {t("Pesanan saya", "My orders")}
              </button>
              <button onClick={() => setOverlay("about")}>
                {t("Pengiriman & retur", "Shipping & returns")}
              </button>
              <button onClick={() => go("member")}>
                {t("Hubungi kami", "Contact us")}
              </button>
            </div>
            <div>
              <h4>{t("Ruang Anda", "Your space")}</h4>
              <button onClick={() => go("member")}>
                {t("Dashboard member", "Member dashboard")}
              </button>
              <button onClick={() => go("wishlist")}>
                {t("Favorit", "Wishlist")}
              </button>
              <button onClick={() => go("admin")}>
                {t("Studio admin", "Admin studio")}
              </button>
            </div>
          </div>
          <div className="footer-payment-bar">
            <PaymentPartnersStrip
              label={t("Kanal Pembayaran Resmi", "Official Payment Methods")}
            />
          </div>
          <div className="footer-bottom">
            <span>
              © 2026 {db.settings.name}.{" "}
              {t("Seluruh hak dilindungi.", "All rights reserved.")}
            </span>
            <span>{currency} · {t("Indonesia", "English")}</span>
            <span>
              {t(
                "Valerie & CO Atelier · Flagship Online Resmi",
                "Valerie & CO Atelier · Official Online Flagship",
              )}
            </span>
          </div>
        </footer>
      )}
      {!((view === "member" && !!member) ||
        (view === "admin" &&
          (!serverMode || isStudioRole(backendUser?.role)))) && (
        <LayoutGroup id="mobile-bottom-nav">
          <motion.nav
            className="mobile-bottom"
            aria-label={t("Navigasi mobile", "Mobile navigation")}
            initial={reduced ? false : { y: 36, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={
              reduced
                ? { duration: 0 }
                : { type: "spring", stiffness: 360, damping: 28, mass: 0.85 }
            }
          >
            {[
              { v: "home", label: t("Beranda", "Home"), Icon: Home },
              { v: "shop", label: t("Koleksi", "Shop"), Icon: LayoutGrid },
              { v: "wishlist", label: t("Favorit", "Saved"), Icon: Heart },
              { v: "bag", label: t("Tas", "Bag"), Icon: ShoppingBag },
              { v: "member", label: t("Akun", "Account"), Icon: User },
            ].map(({ v, label, Icon }) => {
              const isActive =
                v === "bag"
                  ? overlay === "bag"
                  : overlay !== "bag" && view === v;
              const badgeCount =
                v === "bag"
                  ? bagCount
                  : v === "wishlist"
                    ? db.favorites.length
                    : 0;
              return (
                <motion.button
                  key={v}
                  type="button"
                  className={isActive ? "active" : ""}
                  aria-current={isActive ? "page" : undefined}
                  whileTap={reduced ? undefined : { scale: 0.91 }}
                  onClick={() => {
                    if (v === "bag") {
                      setOverlay((cur) => (cur === "bag" ? null : "bag"));
                    } else {
                      setOverlay(null);
                      go(v as View);
                    }
                  }}
                >
                  {isActive && (
                    <motion.span
                      layoutId="mobile-bottom-pill"
                      className="mobile-bottom-pill"
                      aria-hidden="true"
                      transition={
                        reduced
                          ? { duration: 0 }
                          : {
                              type: "spring",
                              stiffness: 460,
                              damping: 32,
                              mass: 0.72,
                            }
                      }
                    />
                  )}
                  <motion.span
                    className="mobile-bottom-icon"
                    animate={
                      isActive && !reduced
                        ? { y: -1.5, scale: 1.08 }
                        : { y: 0, scale: 1 }
                    }
                    transition={
                      reduced
                        ? { duration: 0 }
                        : { type: "spring", stiffness: 420, damping: 24 }
                    }
                  >
                    <Icon size={19} aria-hidden="true" />
                    <AnimatePresence>
                      {badgeCount > 0 && (
                        <motion.b
                          key={`${v}-${badgeCount}`}
                          initial={reduced ? false : { scale: 0.4, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={reduced ? undefined : { scale: 0.4, opacity: 0 }}
                          transition={
                            reduced
                              ? { duration: 0 }
                              : { type: "spring", stiffness: 520, damping: 24 }
                          }
                        >
                          {badgeCount}
                        </motion.b>
                      )}
                    </AnimatePresence>
                  </motion.span>
                  <span className="mobile-bottom-label">{label}</span>
                </motion.button>
              );
            })}
          </motion.nav>
        </LayoutGroup>
      )}
      {overlay === "search" && (
        <Modal
          title={t("Temukan favorit berikutnya", "Find your next favourite")}
          onClose={() => {
            setQuery("");
            setOverlay(null);
          }}
        >
          <label className="search-input" htmlFor="store-search-input">
            <Search />
            <input
              id="store-search-input"
              name="q"
              type="search"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t(
                "Cari model sepatu atau kategori…",
                "Search shoe model or category…",
              )}
            />
          </label>
          <div className="search-results">
            {products
              .filter((p) =>
                `${p.brand} ${p.name} ${p.category}`
                  .toLowerCase()
                  .includes(query.toLowerCase()),
              )
              .map((p) => (
                <button key={p.id} onClick={() => detail(p)}>
                  <CutoutImg src={p.images[0]} alt="" />
                  <span>
                    <b>{p.name}</b>
                    <small>{p.category}</small>
                  </span>
                  <span>{priceText(p)}</span>
                  <ArrowUpRight size={16} />
                </button>
              ))}
          </div>
          {!products.some((p) =>
            `${p.brand} ${p.name} ${p.category}`
              .toLowerCase()
              .includes(query.toLowerCase()),
          ) && (
            <Empty
              title={t("Produk tidak ditemukan", "No pieces found")}
              body={t(
                "Coba nama model atau kategori (Heels, Boots, Sneakers, Flatshoes).",
                "Try a shoe name or category (Heels, Boots, Sneakers, Flatshoes).",
              )}
            />
          )}
        </Modal>
      )}
      {overlay === "bag" && (
        <Modal
          title={t("Tas belanja", "Your shopping bag") + ` (${bagCount})`}
          onClose={() => setOverlay(null)}
        >
          <Bag
            onShop={() => {
              setOverlay(null);
              shop();
            }}
            onCheckout={() => setOverlay(member ? "checkout" : "entry")}
          />
        </Modal>
      )}
      {overlay === "entry" && (
        <Modal
          title={t("Selamat datang di Valerie & CO", "Welcome to Valerie & CO")}
          onClose={() => setOverlay(null)}
        >
          <MemberEntry
            onDone={() => setOverlay(db.bag.length ? "checkout" : null)}
          />
        </Modal>
      )}
      {overlay === "checkout" && (
        <Modal
          title={t("Selesaikan pesanan", "Complete your order")}
          onClose={() => setOverlay(null)}
          wide
        >
          <Checkout
            onDone={() => {
              setOverlay(null);
              go("member");
            }}
          />
        </Modal>
      )}
      {overlay === "about" && (
        <Modal
          title={t("Dunia Valerie & CO", "The world of Valerie & CO")}
          onClose={() => setOverlay(null)}
        >
          <div className="story">
            <div className="story-hero-card">
              <span className="eyebrow">
                {t("ATELIER & FILOSOFI KURASI", "ATELIER & CURATION PHILOSOPHY")}
              </span>
              <h2>
                {t("Setiap langkah punya cerita.", "Every step tells a story.")}
              </h2>
              <p>
                {t(
                  "Valerie & CO mempertemukan siluet arsitektural dan keahlian kriya kontemporer melalui kurasi alas kaki yang dirancang untuk karakter personal Anda.",
                  "Valerie & CO brings architectural silhouettes and contemporary craftsmanship together through a footwear edit curated for your personal point of view.",
                )}
              </p>
            </div>
            <div className="story-pillars">
              <div className="story-pillar">
                <ShieldCheck size={18} />
                <strong>{t("100% Terkurasi Resmi", "100% Authenticated")}</strong>
                <small>
                  {t(
                    "Setiap pasang melalui inspeksi kualitas dan keaslian berlapis di studio kami.",
                    "Every pair undergoes multi-point quality and authenticity inspection.",
                  )}
                </small>
              </div>
              <div className="story-pillar">
                <Truck size={18} />
                <strong>{t("Pengiriman Prioritas", "Priority Fulfilment")}</strong>
                <small>
                  {t(
                    "Dikemas eksklusif dengan pelindung debu dan pelacakan pengiriman penuh.",
                    "Packaged in signature dust-bag protection with full door-to-door tracking.",
                  )}
                </small>
              </div>
              <div className="story-pillar">
                <Headphones size={18} />
                <strong>{t("Layanan Concierge", "Personal Concierge")}</strong>
                <small>
                  {t(
                    "Konsultasi ukuran EU dan perawatan material langsung bersama spesialis kami.",
                    "EU sizing consultation and material care guidance with our specialists.",
                  )}
                </small>
              </div>
            </div>
            <details open>
              <summary>{t("Pengiriman & Estimasi", "Shipping & Delivery")}</summary>
              <p>
                {t(
                  `Pengiriman standar: ${money(SHIPPING_RATES[currency].standard)} (3–5 hari kerja), gratis untuk subtotal minimal ${money(SHIPPING_RATES[currency].freeAbove)}. Pengiriman ekspres prioritas: ${money(SHIPPING_RATES[currency].express)} (1–2 hari kerja).`,
                  `Standard shipping: ${money(SHIPPING_RATES[currency].standard)} (3–5 business days), complimentary on subtotals of ${money(SHIPPING_RATES[currency].freeAbove)} or more. Priority express shipping: ${money(SHIPPING_RATES[currency].express)} (1–2 business days).`,
                )}
              </p>
            </details>
            <details>
              <summary>{t("Garansi Penukaran Ukuran & Retur", "Size Exchange & Returns")}</summary>
              <p>
                {t(
                  "Penukaran ukuran tersedia dalam 14 hari sejak pesanan diterima selama sepatu dalam kondisi belum dikenakan di luar ruangan beserta kemasan aslinya.",
                  "Complimentary size exchanges within 14 days of delivery, provided footwear remains unworn outdoors in original packaging.",
                )}
              </p>
            </details>
            <button
              type="button"
              className="button dark full"
              style={{ marginTop: 18 }}
              onClick={() => {
                setOverlay(null);
                shop();
              }}
            >
              {t("Jelajahi Koleksi 2026", "Explore the 2026 Collection")}
              <ArrowUpRight size={16} />
            </button>
          </div>
        </Modal>
      )}
      {s.pending && (
        <div role="status" className="saving-indicator">
          {t("Menyimpan ke server…", "Saving to server…")}
        </div>
      )}
      {s.toast && (
        <div role="status" className="toast">
          <Check size={18} />
          {s.toast}
        </div>
      )}
      {s.storageError && (
        <div role="alert" className="toast error">
          {t(
            "Penyimpanan browser penuh. Perubahan tidak dapat disimpan.",
            "Browser storage is full. Changes cannot be saved.",
          )}
        </div>
      )}
      {String(import.meta.env.VITE_WHATSAPP_NUMBER || "").trim() && (
        <a
          href={`https://wa.me/${String(import.meta.env.VITE_WHATSAPP_NUMBER).replace(/\D/g, "")}?text=${encodeURIComponent(
            t(
              `Halo ${db.settings.name}, saya ingin bertanya mengenai koleksi sepatu.`,
              `Hello ${db.settings.name}, I would like to inquire about your footwear collection.`,
            ),
          )}`}
          target="_blank"
          rel="noreferrer"
          className="wa-concierge-float"
          title="WhatsApp Concierge"
        >
          <Headphones size={16} />
          <span>CONCIERGE</span>
        </a>
      )}
    </div>
  );
}
function ArrowDown() {
  return <ArrowRight size={16} style={{ transform: "rotate(90deg)" }} />;
}
export function ProductCard({
  product: p,
  onSelect,
}: {
  product: Item;
  onSelect: () => void;
}) {
  const { db, favorite, t, priceText } = useStore();
  const reduced = useReducedMotion();
  const cardImg = p.showcaseImage || p.images[0];
  return (
    <motion.article
      className="product-card"
      style={{ transformPerspective: 1000 }}
      initial={reduced ? false : { opacity: 0, y: 20, rotateX: 4 }}
      whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
      viewport={{ once: true, amount: 0.05 }}
      whileTap={reduced ? undefined : { scale: 0.99 }}
      transition={{ duration: reduced ? 0 : 0.42, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="product-image">
        <button
          className="product-image-link"
          aria-label={`${p.brand} ${p.name}`}
          onClick={onSelect}
        >
          <CutoutImg src={cardImg} alt="" loading="lazy" />
        </button>
        {p.fresh && <span className="product-badge">{t("BARU", "NEW")}</span>}
        <button
          className={`favorite icon ${db.favorites.includes(p.id) ? "saved" : ""}`}
          onClick={() => favorite(p.id)}
          aria-label={t("Simpan favorit", "Save favourite")}
          aria-pressed={db.favorites.includes(p.id)}
        >
          <Heart size={18} aria-hidden="true" />
        </button>
        <button className="quick-view" onClick={onSelect}>
          {t("Lihat detail", "Quick view")}
          <Plus size={14} aria-hidden="true" />
        </button>
      </div>
      <button className="product-info" onClick={onSelect}>
        <h3>{p.name}</h3>
        <span className="product-price">{priceText(p)}</span>
      </button>
      <div className="product-meta-row">
        <span className="product-cat-pill">{p.category}</span>
        <small>
          {p.stock === 0
            ? t("Stok habis", "Sold out")
            : p.details?.code || t("Tersedia", "In stock")}
        </small>
      </div>
    </motion.article>
  );
}
function ProductDetail({
  product: p,
  back,
  openBag,
  editorial = false,
}: {
  product: Item;
  editorial?: boolean;
  back: () => void;
  openBag: () => void;
}) {
  const { t, lang, currency, money, db, favorite, add, notify } = useStore();
  const [photo, setPhoto] = useState(0);
  const [size, setSize] = useState<number | null>(() =>
    p.sizes.includes(39) ? 39 : p.sizes[0] ?? null,
  );
  const [qty, setQty] = useState(1);
  const [guide, setGuide] = useState(false);
  const [zoom, setZoom] = useState(false);
  return (
    <section
      className={`detail-page section ${editorial ? "editorial-detail" : ""}`}
    >
      <button className="text-link back" onClick={back}>
        <ArrowLeft size={16} />
        {t("Kembali ke koleksi", "Back to collection")}
      </button>
      {editorial && (
        <div className="editorial-detail-stage">
          <CutoutImg src={showcaseImage(p)} alt={p.name} />
          <div className="editorial-detail-title">
            <span className="editorial-detail-kicker">{p.brand}</span>
            <p>{p.name}</p>
          </div>
        </div>
      )}
      <div className="detail-layout">
        <div className="detail-gallery">
          <button
            className="detail-main-image"
            onClick={() => setZoom(true)}
            aria-label={t("Perbesar foto", "Enlarge photo")}
          >
            <CutoutImg src={p.images[photo]} alt={`${p.name} ${photo + 1}`} />
            <span>
              {photo + 1} / {p.images.length}
              <Plus size={18} />
            </span>
          </button>
          {p.images.length > 1 && (
            <div className="thumbnails">
              {p.images.map((image, i) => (
                <button
                  key={image}
                  className={photo === i ? "active" : ""}
                  onClick={() => setPhoto(i)}
                  aria-label={`${t("Foto", "Photo")} ${i + 1}`}
                >
                  <CutoutImg src={image} alt="" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="detail-info">
          <span className="eyebrow">{p.category} / VALERIE & CO ATELIER</span>
          <h1>{p.name}</h1>
          <div className="price-row">
            <div className="price-primary">
              <strong>
                {money(itemPrice(p, currency), currency)}
              </strong>
              <span>
                {currency === "IDR"
                  ? t("Harga butik IDR", "IDR catalogue price")
                  : t("Harga katalog USD", "USD catalogue price")}
              </span>
            </div>
            {currency === "IDR" ? (
              <div className="price-idr-chip">
                <strong>{money(p.price, "USD")}</strong>
                <small>{t("Referensi USD", "USD ref.")}</small>
              </div>
            ) : (
              p.priceIdr && (
                <div className="price-idr-chip">
                  <strong>{money(p.priceIdr, "IDR")}</strong>
                  <small>{t("Estimasi IDR", "Est. IDR")}</small>
                </div>
              )
            )}
          </div>
          <p>{p.description[lang]}</p>
          <div className="size-heading">
            <span>
              {t("Ukuran", "Size")} (EU){size && ` · ${size}`}
            </span>
            <button className="text-link" onClick={() => setGuide(true)}>
              {t("Panduan ukuran", "Size guide")}
            </button>
          </div>
          <div className="size-options">
            {p.sizes.map((n) => (
              <button
                key={n}
                className={size === n ? "selected" : ""}
                aria-pressed={size === n}
                onClick={() => setSize(n)}
              >
                {n}
              </button>
            ))}
          </div>
          <span className="stock-note">
            <i className={p.stock ? "" : "sold"} />
            {p.stock
              ? t("Tersedia untuk pesanan", "Available to order")
              : t("Stok habis", "Sold out")}
          </span>
          <div className="buy-row">
            <div className="quantity">
              <button
                onClick={() => setQty(Math.max(1, qty - 1))}
                aria-label={t("Kurangi jumlah", "Decrease quantity")}
              >
                <Minus size={14} />
              </button>
              <span>{qty}</span>
              <button
                onClick={() =>
                  setQty(Math.max(1, Math.min(p.stock || 1, qty + 1)))
                }
                disabled={!p.stock || qty >= p.stock}
                aria-label={t("Tambah jumlah", "Increase quantity")}
              >
                <Plus size={14} />
              </button>
            </div>
            <button
              className="button dark"
              disabled={!p.stock}
              onClick={() => {
                if (!size) {
                  notify(
                    "Pilih ukuran terlebih dahulu",
                    "Please select your size",
                  );
                  return;
                }
                if (
                  add({
                    productId: p.id,
                    size,
                    color: p.colors[0]?.name || "Signature",
                    quantity: qty,
                  })
                )
                  openBag();
              }}
            >
              <ShoppingBag size={18} />
              {t("Tambah ke tas", "Add to bag")}
            </button>
            <button
              className={`icon bordered ${db.favorites.includes(p.id) ? "saved" : ""}`}
              onClick={() => favorite(p.id)}
              aria-label={t("Simpan favorit", "Save favourite")}
            >
              <Heart />
            </button>
          </div>
          <div className="detail-perks">
            <span>
              <Truck size={16} />
              {t(
                `Gratis ongkir mulai ${money(SHIPPING_RATES[currency].freeAbove)}`,
                `Complimentary shipping from ${money(SHIPPING_RATES[currency].freeAbove)}`,
              )}
            </span>
            <span>
              <RefreshCw size={16} />
              {t(
                "Bantuan retur melalui member",
                "Returns support in your member space",
              )}
            </span>
          </div>
          <details open>
            <summary>{t("Detail produk", "Product details")}</summary>
            <p>
              {t("Kode produk / SKU", "Product code / SKU")}:{" "}
              <b>{p.details?.code || p.id.toUpperCase()}</b>
            </p>
            {p.details?.composition?.[lang] && (
              <p>
                {t("Material", "Composition")}: {p.details.composition[lang]}
              </p>
            )}
            {p.details?.sole?.[lang] && (
              <p>
                {t("Sol", "Sole")}: {p.details.sole[lang]}
              </p>
            )}
            {p.details?.origin && (
              <p>
                {t("Asal produksi", "Origin")}: {p.details.origin}
              </p>
            )}
          </details>
          <details>
            <summary>
              {t("Pengiriman & pengembalian", "Delivery & returns")}
            </summary>
            <p>
              {t(
                `Pengiriman standar ${money(SHIPPING_RATES[currency].standard)} atau ekspres ${money(SHIPPING_RATES[currency].express)}. Ajukan penukaran atau bantuan langsung melalui dashboard member Anda.`,
                `Standard delivery ${money(SHIPPING_RATES[currency].standard)} or express ${money(SHIPPING_RATES[currency].express)}. Request size exchange or assistance directly from your member dashboard.`,
              )}
            </p>
          </details>
          <details>
            <summary>{t("Perawatan", "Care instructions")}</summary>
            <p>
              {t(
                "Bersihkan dengan kain lembut. Hindari pencucian mesin dan paparan panas langsung. Simpan di tempat kering.",
                "Clean with a soft cloth. Avoid machine washing and direct heat. Store in a dry place.",
              )}
            </p>
          </details>
        </div>
      </div>
      {guide && (
        <Modal
          title={t("Panduan ukuran EU", "EU size guide")}
          onClose={() => setGuide(false)}
        >
          <p>
            {t(
              "Panduan perkiraan panjang kaki standar EU.",
              "Approximate EU foot length measurements.",
            )}
          </p>
          <table>
            <thead>
              <tr>
                <th>EU</th>
                <th>{t("Panjang kaki (cm)", "Foot length (cm)")}</th>
              </tr>
            </thead>
            <tbody>
              {p.sizes.map((n) => (
                <tr key={n}>
                  <td>{n}</td>
                  <td>{(22.5 + (n - 36) * 0.65).toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Modal>
      )}
      {zoom && (
        <Modal title={p.name} onClose={() => setZoom(false)} wide>
          <CutoutImg className="zoom-image" src={p.images[photo]} alt={p.name} />
        </Modal>
      )}
    </section>
  );
}
function Benefits({
  onOpenAbout,
  onShop,
  onCare,
}: {
  onOpenAbout: () => void;
  onShop: () => void;
  onCare: () => void;
}) {
  const { t, currency, money } = useStore();
  const reduced = useReducedMotion();
  return (
    <section className="benefits section">
      {[
        {
          Icon: Truck,
          title: t("Pengiriman mudah", "Thoughtful delivery"),
          text: t(
            `Gratis ongkir mulai ${money(SHIPPING_RATES[currency].freeAbove)}`,
            `Complimentary from ${money(SHIPPING_RATES[currency].freeAbove)}`,
          ),
          action: onOpenAbout,
        },
        {
          Icon: RefreshCw,
          title: t("Bantuan retur", "Returns assistance"),
          text: t("Dari ruang member Anda", "From your member space"),
          action: onCare,
        },
        {
          Icon: ShieldCheck,
          title: t("Belanja dengan jelas", "Shop with clarity"),
          text: t("Detail di setiap langkah", "Details at every step"),
          action: onShop,
        },
        {
          Icon: Headphones,
          title: t("Layanan personal", "Personal assistance"),
          text: t("Kami siap membantu", "We are here to help"),
          action: onCare,
        },
      ].map(({ Icon, title, text, action }, idx) => (
        <motion.button
          type="button"
          key={title}
          className="benefit-card"
          onClick={action}
          initial={reduced ? false : { opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-20px" }}
          whileHover={reduced ? undefined : { y: -4, scale: 1.015 }}
          whileTap={reduced ? undefined : { scale: 0.985 }}
          transition={{
            duration: reduced ? 0 : 0.42,
            delay: reduced ? 0 : idx * 0.05,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          <span className="benefit-icon-halo" aria-hidden="true">
            <Icon size={22} strokeWidth={1.5} />
          </span>
          <span>
            <em className="benefit-index">0{idx + 1} · ATELIER</em>
            <strong>{title}</strong>
            <small>{text}</small>
          </span>
        </motion.button>
      ))}
    </section>
  );
}
function Newsletter() {
  const { t, db, setDb, notify } = useStore();
  return (
    <section className="newsletter section">
      <div>
        <span className="eyebrow">
          {t("TETAP TERHUBUNG", "LET’S STAY IN TOUCH")}
        </span>
        <h2>{t("Jadi yang pertama tahu.", "A little ahead of the curve.")}</h2>
        <p>
          {t(
            "Daftarkan minat untuk kabar koleksi berikutnya.",
            "Register your interest in our next collection.",
          )}
        </p>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const email = String(f.get("email")).trim().toLowerCase();
          if (!db.subscribers.includes(email))
            setDb((d) => ({ ...d, subscribers: [...d.subscribers, email] }));
          notify(
            "Email Anda terdaftar untuk pembaruan koleksi Valerie & CO",
            "Your email is registered for Valerie & CO collection updates",
          );
          e.currentTarget.reset();
        }}
      >
        <label className="sr-only" htmlFor="newsletter-email">
          Email
        </label>
        <input
          id="newsletter-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder={t("Alamat email Anda", "Your email address")}
        />
        <button type="submit">
          {t("Daftar", "Subscribe")}
          <ArrowUpRight size={17} />
        </button>
      </form>
    </section>
  );
}

function MobileHome({
  onShop,
}: {
  onShop: (category?: string) => void;
}) {
  const { db, t } = useStore();
  const activeCount = db.products.filter((p) => p.active).length;
  return (
    <div className="mobile-store-home">
      <div className="mobile-atelier-banner">
        <div>
          <span>ATELIER EDIT 2026</span>
          <strong>
            {t("Siluet Kurasi Valerie & CO", "Valerie & CO Curated Silhouettes")}
          </strong>
        </div>
        <button
          type="button"
          className="mobile-atelier-cta"
          onClick={() => onShop("All")}
        >
          {activeCount} {t("Model", "Pieces")}
          <ArrowUpRight size={12} />
        </button>
      </div>
    </div>
  );
}

/** Luxury warm-shadow skeleton placeholders shown while initial store/chunk data loads. */
function StoreSkeleton({
  view,
  brandName,
  label,
  embedded = false,
}: {
  view: View;
  brandName: string;
  label: string;
  embedded?: boolean;
}) {
  const isMember = view === "member" || view === "admin";
  const body = isMember ? (
    <section className="member-landing skeleton-member" aria-hidden="true">
      <div className="skeleton-member-intro skeleton-hide-mobile">
        <span className="sk-bar sk-eyebrow" />
        <span className="sk-bar sk-display" />
        <span className="sk-bar sk-display sk-short" />
        <span className="sk-bar sk-line sk-mid" />
        <div className="sk-card skeleton-illustration" />
      </div>
      <div className="skeleton-auth-card sk-card">
        <span className="sk-bar sk-card-title" />
        <span className="sk-bar sk-pill-group" />
        <div className="skeleton-tabs">
          <span className="sk-bar sk-tab" />
          <span className="sk-bar sk-tab" />
        </div>
        <span className="sk-bar sk-label" />
        <span className="sk-bar sk-input" />
        <span className="sk-bar sk-label" />
        <span className="sk-bar sk-input" />
        <span className="sk-bar sk-cta" />
        <span className="sk-bar sk-divider" />
        <span className="sk-bar sk-cta sk-google" />
      </div>
    </section>
  ) : view === "detail" ? (
    <section className="section detail-page skeleton-detail" aria-hidden="true">
      <span className="sk-bar sk-breadcrumb" />
      <div className="detail-layout">
        <div className="sk-card skeleton-detail-media" />
        <div className="skeleton-detail-info">
          <span className="sk-bar sk-eyebrow" />
          <span className="sk-bar sk-display" />
          <span className="sk-bar sk-price-box" />
          <div className="skeleton-sizes">
            {[0, 1, 2, 3].map((n) => (
              <span key={n} className="sk-bar sk-size-box" />
            ))}
          </div>
          <span className="sk-bar sk-cta" />
          <span className="sk-bar sk-line" />
          <span className="sk-bar sk-line sk-mid" />
        </div>
      </div>
    </section>
  ) : view === "shop" || view === "wishlist" ? (
    <section className="section catalog-page skeleton-catalog" aria-hidden="true">
      <div className="skeleton-catalog-head">
        <span className="sk-bar sk-eyebrow" />
        <span className="sk-bar sk-heading" />
      </div>
      <div className="skeleton-chips">
        {[0, 1, 2, 3, 4].map((n) => (
          <span key={n} className="sk-bar sk-chip" />
        ))}
      </div>
      <div className="product-grid skeleton-grid">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => (
          <div key={n} className="sk-card skeleton-product-card">
            <div className="sk-bar skeleton-product-img" />
            <span className="sk-bar sk-line sk-mid" />
            <span className="sk-bar sk-price" />
          </div>
        ))}
      </div>
    </section>
  ) : (
    <div className="skeleton-home" aria-hidden="true">
      <div className="skeleton-hero">
        <div className="skeleton-hero-cats skeleton-hide-mobile">
          {[0, 1, 2, 3, 4].map((n) => (
            <span key={n} className="sk-bar sk-cat-bar" />
          ))}
        </div>
        <div className="skeleton-stage">
          <div className="sk-circle skeleton-ghost skeleton-ghost-left skeleton-hide-mobile" />
          <div className="skeleton-pedestal sk-card">
            <div className="sk-circle skeleton-shoe-shadow" />
          </div>
          <div className="sk-circle skeleton-ghost skeleton-ghost-right skeleton-hide-mobile" />
        </div>
        <div className="skeleton-hero-caption">
          <span className="sk-bar sk-pill-sm" />
          <span className="sk-bar sk-hero-title" />
          <span className="sk-bar sk-hero-sub" />
          <div className="skeleton-hero-controls">
            <span className="sk-circle sk-arrow" />
            <span className="sk-bar sk-hero-cta" />
            <span className="sk-circle sk-arrow" />
          </div>
        </div>
      </div>
      <div className="skeleton-ribbon">
        <span className="sk-bar sk-ribbon-bar" />
      </div>
      <section className="section">
        <div className="skeleton-catalog-head">
          <span className="sk-bar sk-eyebrow" />
          <span className="sk-bar sk-heading" />
        </div>
        <div className="product-grid skeleton-grid">
          {[0, 1, 2, 3].map((n) => (
            <div key={n} className="sk-card skeleton-product-card">
              <div className="sk-bar skeleton-product-img" />
              <span className="sk-bar sk-line sk-mid" />
              <span className="sk-bar sk-price" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );

  if (embedded) {
    return (
      <div className="solere-skeleton solere-skeleton-embedded" role="status" aria-busy="true">
        <span className="sr-only">{label}</span>
        {body}
      </div>
    );
  }

  return (
    <div
      className={`solere-app solere-skeleton ${view === "home" ? "reference-home" : ""}`}
      role="status"
      aria-busy="true"
    >
      <span className="sr-only">{label}</span>
      <header className="reference-header skeleton-top-bar" aria-hidden="true">
        <div className="reference-nav skeleton-nav">
          <div className="reference-nav-group reference-nav-left">
            <span className="sk-bar sk-nav-link" />
            <span className="sk-bar sk-nav-link" />
          </div>
          <span className="reference-wordmark skeleton-wordmark">{brandName}</span>
          <div className="reference-nav-group reference-nav-right">
            <span className="sk-bar sk-nav-link" />
            <span className="sk-bar sk-nav-link" />
          </div>
        </div>
        <div className="reference-actions">
          <div className="reference-action-icons">
            {[0, 1, 2, 3].map((n) => (
              <span key={n} className="sk-circle sk-icon-dot" />
            ))}
          </div>
        </div>
      </header>
      <header className="site-header skeleton-mobile-header" aria-hidden="true">
        <span className="wordmark">{brandName}</span>
        <div className="header-actions">
          <span className="sk-circle sk-icon-dot" />
          <span className="sk-circle sk-icon-dot" />
        </div>
      </header>
      <main id="main-content" tabIndex={-1}>
        {body}
      </main>
    </div>
  );
}

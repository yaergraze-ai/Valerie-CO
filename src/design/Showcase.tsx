import { useEffect, useRef, useState, type ReactNode } from "react";
import gsap from "gsap";
import {
  motion,
  AnimatePresence,
  animate,
  useMotionValue,
  useTransform,
  useReducedMotion,
  type MotionValue,
} from "framer-motion";
import {
  LayoutGrid,
  GalleryHorizontalEnd,
  ArrowLeft,
  ArrowRight,
  ShoppingBag,
  Heart,
  ChevronDown,
  Star,
  X,
} from "lucide-react";
import { useStore } from "./store";
import { SHIPPING_RATES } from "./commerce";
import { type Item } from "./catalog";
import {
  salesTotals,
  showcaseItems,
  orbitPose,
  showcaseImage,
} from "./showcase-data";
import { CutoutImg } from "./bg-remove";

const defaultEditorialRank: Record<string, number> = {
  "vco-zavira-espresso-ankle": 100,
  "vco-velora-blush-chunky": 98,
  "vco-rosella-petal-bow-mule": 96,
  "vco-velora-butter-bow-slingback": 94,
  "vco-velora-blush-slouch-tall": 92,
  "vco-lunara-blush-air-runner": 90,
  "vco-zeriva-cocoa-gloss-mule": 88,
  "vco-lunera-blush-sling-flat": 86,
  "vco-lunera-petal-lace-tall": 84,
  "vco-kivora-white-gray-motion": 82,
  "vco-novara-mocha-wave-mule": 80,
  "vco-kivora-olive-ribbon-ballet": 78,
  "vco-morlix-cocoa-slouch": 76,
  "vco-avenza-cream-gold-runner": 74,
  "vco-orvella-cocoa-croc-point": 72,
  "vco-avenza-lemon-double-strap": 70,
  "vco-kivora-chestnut-riding": 68,
  "vco-rosella-coral-run": 66,
  "vco-varelle-oxblood-bow-mule": 64,
  "vco-rosella-lace-mary-jane": 62,
  "vco-orvella-taupe-buckle": 60,
  "vco-orvella-rose-wave": 58,
  "vco-zavira-ruby-lace-sling": 56,
  "vco-orvella-custard-square-toe": 54,
  "vco-elvora-ivory-block": 52,
  "vco-elvora-aqua-knit": 50,
  "vco-kivora-olive-suede-mule": 48,
  "vco-zavira-bordeaux-ballet": 46,
  "vco-avenza-sand-western": 44,
  "vco-zavira-dusty-trek": 42,
  "vco-lunera-ivory-woven-mule": 40,
  "vco-elvora-sage-slingback": 38,
  "vco-morlix-urban-trail": 36,
  "vco-morlix-bordeaux-strap-sling": 34,
  "vco-morlix-nude-cross-strap": 32,
  "vco-novara-cream-slip-on": 30,
  "vco-elvora-wine-mirror-pump": 28,
  "vco-novara-rose-ballet": 26,
  "vco-zavira-burgundy-court": 24,
  "vco-avenza-noir-edge-mule": 22,
};

const referenceGridOrder = [
  "vco-zavira-espresso-ankle",
  "vco-velora-blush-chunky",
  "vco-rosella-petal-bow-mule",
  "vco-velora-butter-bow-slingback",
  "vco-velora-blush-slouch-tall",
  "vco-lunara-blush-air-runner",
  "vco-zeriva-cocoa-gloss-mule",
  "vco-lunera-blush-sling-flat",
  "vco-lunera-petal-lace-tall",
  "vco-kivora-white-gray-motion",
  "vco-novara-mocha-wave-mule",
  "vco-kivora-olive-ribbon-ballet",
  "vco-morlix-cocoa-slouch",
  "vco-avenza-cream-gold-runner",
  "vco-orvella-cocoa-croc-point",
  "vco-avenza-lemon-double-strap",
  "vco-kivora-chestnut-riding",
  "vco-rosella-coral-run",
  "vco-varelle-oxblood-bow-mule",
  "vco-rosella-lace-mary-jane",
  "vco-orvella-taupe-buckle",
  "vco-orvella-rose-wave",
  "vco-zavira-ruby-lace-sling",
  "vco-orvella-custard-square-toe",
  "vco-elvora-ivory-block",
  "vco-elvora-aqua-knit",
  "vco-kivora-olive-suede-mule",
  "vco-zavira-bordeaux-ballet",
  "vco-avenza-sand-western",
  "vco-zavira-dusty-trek",
  "vco-lunera-ivory-woven-mule",
  "vco-elvora-sage-slingback",
  "vco-morlix-urban-trail",
  "vco-morlix-bordeaux-strap-sling",
  "vco-morlix-nude-cross-strap",
  "vco-novara-cream-slip-on",
  "vco-elvora-wine-mirror-pump",
  "vco-novara-rose-ballet",
  "vco-zavira-burgundy-court",
  "vco-avenza-noir-edge-mule",
];

export function Showcase({
  onOpenBag,
}: {
  renderDetail?: (p: Item, close: () => void) => ReactNode;
  onSearch?: () => void;
  onOpenBag?: () => void;
}) {
  const { db, t, serverMode, priceText } = useStore();
  const [category, setCategory] = useState("All");
  const [subCategory, setSubCategory] = useState<string>("All");
  const [grid, setGrid] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const computedSales = serverMode ? db.sales || {} : salesTotals(db.orders);
  const effectiveSales =
    Object.keys(computedSales).length > 0 ? computedSales : defaultEditorialRank;

  const products = showcaseItems(
    db.products,
    db.settings.homepage,
    effectiveSales,
    category,
    subCategory,
  );

  const gridProducts =
    category === "All" && subCategory === "All"
      ? [...products].sort((a, b) => {
          const ia = referenceGridOrder.indexOf(a.id);
          const ib = referenceGridOrder.indexOf(b.id);
          if (ia !== -1 && ib !== -1) return ia - ib;
          if (ia !== -1) return -1;
          if (ib !== -1) return 1;
          return 0;
        })
      : products;

  const selected =
    products.find((p) => p.id === selectedId) ||
    db.products.find((p) => p.id === selectedId && p.active) ||
    null;
  const reduced = useReducedMotion();

  const outlineHeadings = [
    { key: "Heels", label: "HEELS" },
    { key: "Boots", label: "BOOTS" },
    { key: "Sneakers", label: "SNEAKERS" },
    { key: "Flatshoes", label: "FLATSHOES" },
    { key: "All", label: "ALL SHOES" },
  ];

  const selectMainCategory = (cat: string) => {
    setCategory(cat);
    setSubCategory("All");
    setSelectedId(null);
  };

  return (
    <section
      className={`showcase orbital-showcase ${grid ? "showcase-grid-view" : ""} ${selected ? "showcase-detail-mode" : ""}`}
      aria-label={t("Koleksi unggulan", "Featured collection")}
    >
      <AnimatePresence initial={false}>
        {!selected && (
          <motion.aside
            key="outline-nav"
            className="outline-nav"
            initial={{ opacity: 0, x: reduced ? 0 : -28 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: reduced ? 0 : -36 }}
            transition={{ duration: reduced ? 0 : 0.38, ease: [0.22, 1, 0.36, 1] }}
          >
            {outlineHeadings.map((item) => (
              <button
                key={item.key}
                type="button"
                className={category === item.key ? "selected" : ""}
                aria-pressed={category === item.key}
                onClick={() => selectMainCategory(item.key)}
              >
                {item.label}
              </button>
            ))}
          </motion.aside>
        )}
      </AnimatePresence>

      {!selected && (
        <div className="showcase-top">
          <div className="view-toggle">
            <button
              className={!grid ? "active" : ""}
              aria-label={t("Tampilan showcase", "Showcase view")}
              aria-pressed={!grid}
              onClick={() => setGrid(false)}
            >
              <GalleryHorizontalEnd size={14} />
            </button>
            <button
              className={grid ? "active" : ""}
              aria-label={t("Tampilan katalog", "Catalog view")}
              aria-pressed={grid}
              onClick={() => {
                setSelectedId(null);
                setGrid(true);
              }}
            >
              <LayoutGrid size={14} />
            </button>
          </div>
        </div>
      )}

      {!products.length ? (
        <div className="showcase-empty">
          <h2>{t("Belum ada produk pilihan", "No featured products yet")}</h2>
          <p>
            {t(
              "Koleksi ini sedang disiapkan. Silakan jelajahi kategori lainnya.",
              "This collection is being prepared. Explore another category.",
            )}
          </p>
        </div>
      ) : (
        <AnimatePresence mode="wait" initial={false}>
          {selected ? (
            <MorphEditorialDetail
              key={`detail-${selected.id}`}
              product={selected}
              onBack={() => setSelectedId(null)}
              onOpenBag={onOpenBag}
            />
          ) : grid ? (
            <motion.div
              key={`grid-${category}-${subCategory}`}
              className="showcase-product-grid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduced ? 0 : 0.32 }}
            >
              {gridProducts.map((p, i) => (
                <motion.button
                  key={p.id}
                  className="ssense-grid-card"
                  style={{ transformPerspective: 1100 }}
                  onClick={() => {
                    setGrid(false);
                    setSelectedId(p.id);
                  }}
                  initial={{ opacity: 0, y: reduced ? 0 : 26, rotateX: reduced ? 0 : 8 }}
                  animate={{ opacity: 1, y: 0, rotateX: 0 }}
                  whileTap={reduced ? undefined : { scale: 0.985 }}
                  transition={{
                    duration: reduced ? 0 : 0.44,
                    delay: reduced ? 0 : Math.min(i, 11) * 0.045,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                >
                  <div className="ssense-grid-image">
                    <CutoutImg
                      src={showcaseImage(p)}
                      alt={p.name}
                      loading="lazy"
                    />
                  </div>
                  <div className="ssense-grid-meta">
                    <div>
                      <strong>{p.name}</strong>
                      <span>{p.category}</span>
                    </div>
                    <b className="ssense-grid-price">{priceText(p)}</b>
                  </div>
                </motion.button>
              ))}
            </motion.div>
          ) : (
            <motion.div
              key={`orbit-${category}-${subCategory}`}
              className="orbit-content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{
                duration: reduced ? 0 : 0.38,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <ProductOrbit
                key={category + subCategory + products.map((p) => p.id).join("|")}
                products={products}
                onDetail={(p) => setSelectedId(p.id)}
                blocked={!!selected}
              />
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </section>
  );
}

function MorphEditorialDetail({
  product: p,
  onBack,
  onOpenBag,
}: {
  product: Item;
  onBack: () => void;
  onOpenBag?: () => void;
}) {
  const { t, lang, db, favorite, add, notify, currency, money, priceText } = useStore();
  const reduced = useReducedMotion();
  const [size, setSize] = useState<number>(p.sizes.includes(39) ? 39 : p.sizes[0]);
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [zoomImg, setZoomImg] = useState<string | null>(null);
  const morphShadowRef = useRef<HTMLSpanElement | null>(null);
  const morphHeaderRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
  }, [p.id, reduced]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (zoomImg) setZoomImg(null);
      else onBack();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoomImg, onBack]);

  useEffect(() => {
    if (reduced || !morphHeaderRef.current) return;
    gsap.fromTo(
      morphHeaderRef.current,
      { opacity: 0 },
      {
        opacity: 1,
        duration: 0.42,
        ease: "power2.out",
      },
    );
  }, [reduced]);

  const subtitle = p.name;
  const primaryColorName = p.colors[0]?.name || "Signature";
  const heroArt = showcaseImage(p);
  const saved = db.favorites.includes(p.id);
  const reviewCount = p.reviews?.length ? p.reviews.length + 18 : 20;

  return (
    <motion.div
      className="morph-detail-view"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduced ? 0 : 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      <div
        className="morph-top-stage"
        onMouseMove={(e) => {
          if (reduced) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const nx = (e.clientX - rect.left) / rect.width - 0.5;
          const ny = (e.clientY - rect.top) / rect.height - 0.5;
          const activeEl = e.currentTarget.querySelector(
            ".colorway-orbit-active img",
          );
          if (activeEl) {
            gsap.to(activeEl, {
              rotationY: nx * 16,
              rotationX: -ny * 12,
              rotationZ: nx * -3.5,
              scale: 1.035,
              transformPerspective: 1000,
              duration: 0.45,
              ease: "power3.out",
              overwrite: "auto",
            });
          }
          if (morphShadowRef.current) {
            gsap.to(morphShadowRef.current, {
              x: -nx * 32,
              y: -ny * 10,
              scaleX: 1 + Math.abs(nx) * 0.16,
              opacity: 0.85,
              duration: 0.45,
              ease: "power3.out",
              overwrite: "auto",
            });
          }
        }}
        onMouseLeave={(e) => {
          if (reduced) return;
          const activeEl = e.currentTarget.querySelector(
            ".colorway-orbit-active img",
          );
          if (activeEl) {
            gsap.to(activeEl, {
              rotationY: 0,
              rotationX: 0,
              rotationZ: 0,
              scale: 1,
              duration: 0.65,
              ease: "elastic.out(1, 0.6)",
              overwrite: "auto",
            });
          }
          if (morphShadowRef.current) {
            gsap.to(morphShadowRef.current, {
              x: 0,
              y: 0,
              scaleX: 1,
              opacity: 1,
              duration: 0.65,
              ease: "power3.out",
              overwrite: "auto",
            });
          }
        }}
      >
        <motion.button
          type="button"
          className="morph-back-btn"
          onClick={onBack}
          whileHover={reduced ? undefined : { x: -2 }}
          whileTap={reduced ? undefined : { scale: 0.96 }}
        >
          <span className="morph-back-circle">
            <ArrowLeft size={13} />
          </span>
          <span>{t("Kembali", "Back")}</span>
        </motion.button>

        <div className="morph-stage-shoes">
          <div className="orbit-product colorway-orbit-item colorway-orbit-active">
            <button
              type="button"
              onClick={() => setZoomImg(heroArt)}
              style={{ cursor: "zoom-in", pointerEvents: "auto" }}
              aria-label={`${p.brand} ${subtitle}`}
            >
              <span className="orbit-float-wrap">
                <CutoutImg
                  className="orbit-single"
                  src={heroArt}
                  alt={`${p.brand} ${subtitle}`}
                  draggable={false}
                />
              </span>
            </button>
          </div>
          <span ref={morphShadowRef} className="orbit-shadow" />
        </div>
      </div>

      <div ref={morphHeaderRef} className="morph-sticky-header">
        <div className="morph-header-left">
          <h1>
            <strong>{subtitle}</strong>
          </h1>
          <div className="showcase-subtitle-window">
            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={subtitle + p.category}
                initial={{ y: "100%", opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: "-100%", opacity: 0 }}
                transition={{ duration: reduced ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
              >
                {p.category} · {p.details?.code || p.brand}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>

        <div className="morph-header-right">
          <strong className="morph-price">{priceText(p)}</strong>

          <div className="morph-controls-row">
            <label className="morph-size-select" htmlFor="morph-size-select">
              <span>{t("Ukuran :", "Size :")}</span>
              <select
                id="morph-size-select"
                name="morph-size"
                value={size}
                onChange={(e) => setSize(Number(e.target.value))}
                aria-label={t("Pilih ukuran EU", "Select EU size")}
              >
                {p.sizes.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <ChevronDown size={12} />
            </label>
          </div>

          <div className="morph-actions-row">
            <motion.button
              type="button"
              className="morph-add-btn"
              disabled={!p.stock}
              whileHover={reduced || !p.stock ? undefined : { y: -1.5, scale: 1.015 }}
              whileTap={reduced || !p.stock ? undefined : { scale: 0.97 }}
              onClick={() => {
                if (
                  add({
                    productId: p.id,
                    size,
                    color: primaryColorName,
                    quantity: 1,
                  })
                ) {
                  onOpenBag?.();
                } else {
                  notify("Stok tidak mencukupi", "Insufficient stock");
                }
              }}
            >
              <span>
                {!p.stock
                  ? t("Stok habis", "Sold out")
                  : t("Tambah ke tas", "Add to bag")}
              </span>
              <ShoppingBag size={13} />
            </motion.button>
            <motion.button
              type="button"
              className={`morph-wish-btn ${saved ? "saved" : ""}`}
              whileTap={reduced ? undefined : { scale: 0.88 }}
              onClick={() => favorite(p.id)}
              aria-label={t("Simpan favorit", "Save to wishlist")}
              aria-pressed={saved}
            >
              <Heart size={15} />
            </motion.button>
          </div>
        </div>
      </div>

      <div className="morph-editorial-sheet">
        <div className="morph-gallery-stack">
          {[
            heroArt,
            ...p.images.filter((img) => img !== heroArt),
          ].map((img, idx) => (
            <motion.button
              key={img + idx}
              type="button"
              className="morph-gallery-card"
              onClick={() => setZoomImg(img)}
              initial={reduced ? false : { opacity: 0, y: 24, scale: 0.98 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              whileHover={reduced ? undefined : { y: -3, scale: 1.008 }}
              whileTap={reduced ? undefined : { scale: 0.99 }}
              viewport={{ once: true, margin: "-20px" }}
              transition={{
                duration: reduced ? 0 : 0.48,
                delay: reduced ? 0 : idx * 0.05,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <CutoutImg
                src={img}
                alt={`${p.brand} ${subtitle} ${idx + 1}`}
                loading={idx < 2 ? "eager" : "lazy"}
              />
            </motion.button>
          ))}
        </div>

        <aside className="morph-editorial-copy">
          <p className="morph-lead-description">{p.description[lang]}</p>

          <div className="morph-accordions">
            <div className={`morph-accordion ${openSection === "details" ? "open" : ""}`}>
              <button
                type="button"
                onClick={() => setOpenSection(openSection === "details" ? null : "details")}
                aria-expanded={openSection === "details"}
              >
                <span>{t("Detail Material & Asal", "Details")}</span>
                <ChevronDown size={15} />
              </button>
              <AnimatePresence initial={false}>
                {openSection === "details" && (
                  <motion.div
                    className="morph-accordion-body"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: reduced ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <ul>
                      <li>
                        {p.details?.composition?.[lang] ||
                          t(
                            "Kulit pilihan berkualitas tinggi dengan finishing atelier.",
                            "Premium calfskin leather and technical canvas upper.",
                          )}
                      </li>
                      <li>
                        {p.details?.sole?.[lang] ||
                          t(
                            "Sol ergonomis dengan bantalan presisi yang nyaman.",
                            "Sculpted rubber outsole with ergonomic cushioning.",
                          )}
                      </li>
                      <li>{p.details?.origin || "Made in Italy"}</li>
                      <li>
                        {t("Kode desain", "Style code")}: {p.details?.code || p.id.toUpperCase()}
                      </li>
                    </ul>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className={`morph-accordion ${openSection === "delivery" ? "open" : ""}`}>
              <button
                type="button"
                onClick={() => setOpenSection(openSection === "delivery" ? null : "delivery")}
                aria-expanded={openSection === "delivery"}
              >
                <span>{t("Pengiriman & Retur Gratis", "Free Delivery and Returns")}</span>
                <ChevronDown size={15} />
              </button>
              <AnimatePresence initial={false}>
                {openSection === "delivery" && (
                  <motion.div
                    className="morph-accordion-body"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: reduced ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <p>
                      {t(
                        `Gratis pengiriman standar untuk pesanan di atas ${money(SHIPPING_RATES[currency].freeAbove)}. Penukaran ukuran dan retur diterima dalam 14 hari dengan kemasan asli melalui ruang member Anda.`,
                        `Complimentary standard shipping on orders over ${money(SHIPPING_RATES[currency].freeAbove)}. Returns and size exchanges are accepted within 14 days in original packaging via your member space.`,
                      )}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className={`morph-accordion ${openSection === "reviews" ? "open" : ""}`}>
              <button
                type="button"
                onClick={() => setOpenSection(openSection === "reviews" ? null : "reviews")}
                aria-expanded={openSection === "reviews"}
              >
                <span>
                  {t("Ulasan", "Reviews")} ({reviewCount})
                </span>
                <ChevronDown size={15} />
              </button>
              <AnimatePresence initial={false}>
                {openSection === "reviews" && (
                  <motion.div
                    className="morph-accordion-body"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: reduced ? 0 : 0.25 }}
                  >
                    <div className="morph-reviews-summary">
                      <div className="morph-stars">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star key={n} size={13} fill="#181818" stroke="#181818" />
                        ))}
                      </div>
                      <span>4.9 / 5.0 · Verified purchasers</span>
                    </div>
                    {(
                      p.reviews || [
                        {
                          author: "Laurent M.",
                          rating: 5,
                          date: "2026-02-19",
                          comment: {
                            en: "Impeccable construction and packaging. Fits true to European sizing.",
                            id: "Konstruksi dan kemasan sangat rapi. Ukuran sesuai standar Eropa.",
                          },
                        },
                        {
                          author: "Elena S.",
                          rating: 5,
                          date: "2026-01-24",
                          comment: {
                            en: "Even more striking in person. The silhouette balances proportion and comfort.",
                            id: "Terlihat jauh lebih memukau secara langsung. Proporsi dan kenyamanannya seimbang.",
                          },
                        },
                      ]
                    ).map((rev, i) => (
                      <div key={i} className="morph-review-item">
                        <strong>{rev.author}</strong>
                        <p>{rev.comment[lang]}</p>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </aside>
      </div>

      <AnimatePresence>
        {zoomImg && (
          <motion.div
            className="morph-lightbox"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.24, ease: [0.22, 1, 0.36, 1] }}
            onClick={() => setZoomImg(null)}
          >
            <button
              type="button"
              className="morph-lightbox-close"
              onClick={(e) => {
                e.stopPropagation();
                setZoomImg(null);
              }}
              aria-label={t("Tutup pratinjau", "Close preview")}
            >
              <X size={18} />
            </button>
            <motion.div
              className="morph-lightbox-stage"
              initial={reduced ? false : { scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={reduced ? undefined : { scale: 0.94, opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
              onClick={(e) => e.stopPropagation()}
            >
              <CutoutImg src={zoomImg} alt={subtitle} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ProductOrbit({
  products,
  onDetail,
  blocked,
}: {
  products: Item[];
  onDetail: (p: Item) => void;
  blocked: boolean;
}) {
  const { t, priceText } = useStore();
  const reduced = useReducedMotion();
  const [step, setStep] = useState(0);
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const dragStartX = useRef<number | null>(null);
  const wheelLock = useRef(false);
  const shadowRef = useRef<HTMLSpanElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);

  const progress = useMotionValue(0);
  const slots = Math.max(3, products.length);
  const index = ((step % slots) + slots) % slots;
  const p = products[index] || products[0];
  const activeSubtitle = p.name;

  const moveStep = (delta: number) => {
    setStep((s) => {
      if (products.length === 2 && delta > 0 && s % slots === 1) return s + 2;
      if (products.length === 2 && delta < 0 && s % slots === 0) return s - 2;
      return s + delta;
    });
  };

  useEffect(() => {
    const control = animate(progress, step, {
      duration: reduced ? 0 : 0.46,
      ease: [0.22, 1, 0.36, 1],
    });
    return () => control.stop();
  }, [step, reduced, progress]);

  useEffect(() => {
    if (products.length < 2 || blocked || reduced || focused || hovered) return;
    const timer = window.setInterval(
      () =>
        setStep((s) => s + (products.length === 2 && s % slots === 1 ? 2 : 1)),
      2600,
    );
    return () => window.clearInterval(timer);
  }, [products.length, slots, blocked, reduced, focused, hovered]);

  return (
    <div
      className="orbit-interaction"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        if (!reduced && shadowRef.current) {
          gsap.to(shadowRef.current, {
            x: 0,
            y: 0,
            scaleX: 1,
            opacity: 1,
            duration: 0.65,
            ease: "power3.out",
            overwrite: "auto",
          });
        }
        if (!reduced && stageRef.current) {
          const activeImg = stageRef.current.querySelector(
            ".orbit-product-active img",
          );
          if (activeImg) {
            gsap.to(activeImg, {
              rotationY: 0,
              rotationX: 0,
              rotationZ: 0,
              scale: 1,
              duration: 0.7,
              ease: "elastic.out(1, 0.65)",
              overwrite: "auto",
            });
          }
        }
      }}
      onMouseMove={(e) => {
        if (reduced) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const nx = (e.clientX - rect.left) / rect.width - 0.5;
        const ny = (e.clientY - rect.top) / rect.height - 0.5;
        if (shadowRef.current) {
          gsap.to(shadowRef.current, {
            x: -nx * 36,
            y: -ny * 12,
            scaleX: 1 + Math.abs(nx) * 0.18,
            opacity: 0.82,
            duration: 0.4,
            ease: "power3.out",
            overwrite: "auto",
          });
        }
        if (stageRef.current) {
          const activeImg = stageRef.current.querySelector(
            ".orbit-product-active img",
          );
          if (activeImg) {
            gsap.to(activeImg, {
              rotationY: nx * 14,
              rotationX: -ny * 10,
              rotationZ: nx * -3,
              scale: 1.025,
              transformPerspective: 1000,
              duration: 0.4,
              ease: "power3.out",
              overwrite: "auto",
            });
          }
        }
      }}
      onPointerDown={(e) => {
        dragStartX.current = e.clientX;
      }}
      onPointerUp={(e) => {
        if (dragStartX.current === null) return;
        const dx = e.clientX - dragStartX.current;
        dragStartX.current = null;
        if (Math.abs(dx) > 48) {
          moveStep(dx < 0 ? 1 : -1);
        }
      }}
      onWheel={(e) => {
        if (Math.abs(e.deltaX) < 18 && Math.abs(e.deltaY) < 28) return;
        if (wheelLock.current) return;
        if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
          e.preventDefault();
          wheelLock.current = true;
          moveStep(e.deltaX > 0 ? 1 : -1);
          window.setTimeout(() => {
            wheelLock.current = false;
          }, 420);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") moveStep(1);
        if (e.key === "ArrowLeft") moveStep(-1);
      }}
      onFocusCapture={(e) =>
        setFocused((e.target as HTMLElement).matches(":focus-visible"))
      }
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node))
          setFocused(false);
      }}
    >
      <div
        ref={stageRef}
        className="orbit-stage"
        role="group"
        aria-roledescription="carousel"
        aria-label={t("Produk pilihan", "Featured products")}
      >
        <div className="showcase-atmosphere" aria-hidden="true">
          <span className="orbit-halo" />
          <span className="orbit-halo secondary" />
        </div>
        {products.map((item, slot) => (
          <OrbitProduct
            key={item.id}
            item={item}
            slot={slot}
            count={products.length}
            progress={progress}
            active={slot === index}
            onClick={() => {
              if (slot === index) onDetail(item);
              else {
                const rawDiff = ((slot - (step % slots) + slots) % slots);
                const shortest = rawDiff > slots / 2 ? rawDiff - slots : rawDiff;
                setStep((s) => s + shortest);
              }
            }}
          />
        ))}
        <span ref={shadowRef} className="orbit-shadow" />
      </div>

      <div className="showcase-description">
        <span className="showcase-index-pill">
          ATELIER 2026 · {String(index + 1).padStart(2, "0")} /{" "}
          {String(products.length).padStart(2, "0")}
        </span>
        <div className="showcase-title-window">
          <AnimatePresence initial={false} mode="popLayout">
            <motion.h1
              key={p.id + "-" + activeSubtitle}
              initial={{ y: "105%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "-105%", opacity: 0 }}
              transition={{
                duration: reduced ? 0 : 0.42,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              {activeSubtitle}
            </motion.h1>
          </AnimatePresence>
        </div>
        <div className="showcase-subtitle-window">
          <AnimatePresence initial={false} mode="popLayout">
            <motion.p
              key={p.id + "-" + p.category}
              initial={{ y: "110%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "-110%", opacity: 0 }}
              transition={{
                duration: reduced ? 0 : 0.38,
                delay: reduced ? 0 : 0.06,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              {p.category}
              <span className="subtitle-pipe">|</span>
              <strong>{priceText(p)}</strong>
            </motion.p>
          </AnimatePresence>
        </div>
        <div className="showcase-cta-row">
          <button
            type="button"
            className="orbit-nav-arrow"
            onClick={() => moveStep(-1)}
            aria-label={t("Produk sebelumnya", "Previous product")}
          >
            <ArrowLeft size={13} />
          </button>
          <button className="button subtle" onClick={() => onDetail(p)}>
            SEE MORE
          </button>
          <button
            type="button"
            className="orbit-nav-arrow"
            onClick={() => moveStep(1)}
            aria-label={t("Produk selanjutnya", "Next product")}
          >
            <ArrowRight size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

function OrbitProduct({
  item,
  slot,
  count,
  progress,
  active,
  onClick,
}: {
  item: Item;
  slot: number;
  count: number;
  progress: MotionValue<number>;
  active: boolean;
  onClick: () => void;
}) {
  const { t } = useStore();
  const x = useTransform(progress, (v) => orbitPose(slot, v, count).x);
  const y = useTransform(progress, (v) => orbitPose(slot, v, count).y);
  const scale = useTransform(progress, (v) => orbitPose(slot, v, count).scale);
  const opacity = useTransform(
    progress,
    (v) => orbitPose(slot, v, count).opacity,
  );
  const filter = useTransform(progress, (v) => orbitPose(slot, v, count).blur);
  const rotate = useTransform(
    progress,
    (v) => orbitPose(slot, v, count).rotate,
  );
  const zIndex = useTransform(progress, (v) => orbitPose(slot, v, count).z);
  const pointerEvents = useTransform(opacity, (v) =>
    v < 0.1 ? ("none" as const) : ("auto" as const),
  );
  return (
    <motion.div
      className={`orbit-product ${active ? "orbit-product-active" : ""}`}
      style={{ x, y, scale, opacity, filter, rotate, zIndex }}
    >
      <motion.button
        style={{
          pointerEvents,
          transform: "translate(-50%, -50%)",
        }}
        tabIndex={active ? 0 : -1}
        onClick={onClick}
        aria-label={`${active ? t("Lihat detail", "View details") : t("Tampilkan", "Show")} ${item.brand} ${item.name}`}
      >
        <span className="orbit-float-wrap">
          <CutoutImg
            fitCircle
            className="orbit-single"
            src={showcaseImage(item)}
            alt={item.name}
            draggable={false}
          />
        </span>
      </motion.button>
    </motion.div>
  );
}

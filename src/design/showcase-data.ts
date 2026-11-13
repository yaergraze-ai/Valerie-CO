import type { Item } from "./catalog";
export { salesTotals } from "../../server/sales.mjs";
export type HomepageSelection = { mode: "bestsellers" | "manual"; productIds: string[] };
export function showcaseItems(
  products: Item[],
  selection: HomepageSelection | undefined,
  sales: Record<string, number>,
  category = "All",
  subCategory = "All",
) {
  const available = products.filter(
    (p) =>
      p.active &&
      p.stock > 0 &&
      (category === "All" || p.category === category) &&
      (subCategory === "All" || p.subCategory === subCategory || p.category === subCategory),
  );
  if (selection?.mode === "manual" && category === "All" && subCategory === "All") {
    return selection.productIds.map((id) => available.find((p) => p.id === id)).filter((p): p is Item => !!p);
  }
  return [...available].sort((a, b) => (sales[b.id] || 0) - (sales[a.id] || 0));
}
export const defaultShowcaseImages: Record<string, string> = {
  "vco-zavira-espresso-ankle": "/shoes/02_Boots/03_zavira_espresso_ankle/03_zavira_espresso_ankle.webp",
  "vco-velora-blush-slouch-tall": "/shoes/02_Boots/01_velora_blush_slouch_tall/01_velora_blush_slouch_tall.webp",
  "vco-lunera-petal-lace-tall": "/shoes/02_Boots/02_lunera_petal_lace_tall/02_lunera_petal_lace_tall.webp",
  "vco-morlix-cocoa-slouch": "/shoes/02_Boots/04_morlix_cocoa_slouch/04_morlix_cocoa_slouch.webp",
  "vco-kivora-chestnut-riding": "/shoes/02_Boots/05_kivora_chestnut_riding/05_kivora_chestnut_riding.webp",
  "vco-orvella-taupe-buckle": "/shoes/02_Boots/06_orvella_taupe_buckle/06_orvella_taupe_buckle.webp",
  "vco-elvora-ivory-block": "/shoes/02_Boots/07_elvora_ivory_block/07_elvora_ivory_block.webp",
  "vco-avenza-sand-western": "/shoes/02_Boots/08_avenza_sand_western/08_avenza_sand_western.webp",
  "vco-velora-blush-chunky": "/shoes/01_Sneakers/01_velora_blush_chunky/01_velora_blush_chunky.webp",
  "vco-lunara-blush-air-runner": "/shoes/01_Sneakers/02_lunara_blush_air_runner/02_lunara_blush_air_runner.webp",
  "vco-kivora-white-gray-motion": "/shoes/01_Sneakers/03_kivora_white_gray_motion/03_kivora_white_gray_motion.webp",
  "vco-avenza-cream-gold-runner": "/shoes/01_Sneakers/04_avenza_cream_gold_runner/04_avenza_cream_gold_runner.webp",
  "vco-rosella-coral-run": "/shoes/01_Sneakers/05_rosella_coral_run/05_rosella_coral_run.webp",
  "vco-orvella-rose-wave": "/shoes/01_Sneakers/06_orvella_rose_wave/06_orvella_rose_wave.webp",
  "vco-elvora-aqua-knit": "/shoes/01_Sneakers/07_elvora_aqua_knit/07_elvora_aqua_knit.webp",
  "vco-zavira-dusty-trek": "/shoes/01_Sneakers/08_zavira_dusty_trek/08_zavira_dusty_trek.webp",
  "vco-morlix-urban-trail": "/shoes/01_Sneakers/09_morlix_urban_trail/09_morlix_urban_trail.webp",
  "vco-novara-cream-slip-on": "/shoes/01_Sneakers/10_novara_cream_slip_on/10_novara_cream_slip_on.webp",
  "vco-zavira-burgundy-court": "/shoes/01_Sneakers/11_zavira_burgundy_court_alternatif/11_zavira_burgundy_court_alternatif.webp",
  "vco-rosella-petal-bow-mule": "/shoes/03_Heels/01_rosella_petal_bow_mule/01_rosella_petal_bow_mule.webp",
  "vco-zeriva-cocoa-gloss-mule": "/shoes/03_Heels/02_zeriva_cocoa_gloss_mule/02_zeriva_cocoa_gloss_mule.webp",
  "vco-novara-mocha-wave-mule": "/shoes/03_Heels/03_novara_mocha_wave_mule/03_novara_mocha_wave_mule.webp",
  "vco-orvella-cocoa-croc-point": "/shoes/03_Heels/04_orvella_cocoa_croc_point/04_orvella_cocoa_croc_point.webp",
  "vco-varelle-oxblood-bow-mule": "/shoes/03_Heels/05_varelle_oxblood_bow_mule/05_varelle_oxblood_bow_mule.webp",
  "vco-zavira-ruby-lace-sling": "/shoes/03_Heels/06_zavira_ruby_lace_sling/06_zavira_ruby_lace_sling.webp",
  "vco-kivora-olive-suede-mule": "/shoes/03_Heels/07_kivora_olive_suede_mule/07_kivora_olive_suede_mule.webp",
  "vco-lunera-ivory-woven-mule": "/shoes/03_Heels/08_lunera_ivory_woven_mule/08_lunera_ivory_woven_mule.webp",
  "vco-morlix-bordeaux-strap-sling": "/shoes/03_Heels/09_morlix_bordeaux_strap_sling/09_morlix_bordeaux_strap_sling.webp",
  "vco-elvora-wine-mirror-pump": "/shoes/03_Heels/10_elvora_wine_mirror_pump/10_elvora_wine_mirror_pump.webp",
  "vco-avenza-noir-edge-mule": "/shoes/03_Heels/11_avenza_noir_edge_mule/11_avenza_noir_edge_mule.webp",
  "vco-velora-butter-bow-slingback": "/shoes/04_Flatshoes/01_velora_butter_bow_slingback/01_velora_butter_bow_slingback.webp",
  "vco-lunera-blush-sling-flat": "/shoes/04_Flatshoes/02_lunera_blush_sling_flat/02_lunera_blush_sling_flat.webp",
  "vco-kivora-olive-ribbon-ballet": "/shoes/04_Flatshoes/03_kivora_olive_ribbon_ballet/03_kivora_olive_ribbon_ballet.webp",
  "vco-avenza-lemon-double-strap": "/shoes/04_Flatshoes/04_avenza_lemon_double_strap/04_avenza_lemon_double_strap.webp",
  "vco-rosella-lace-mary-jane": "/shoes/04_Flatshoes/05_rosella_lace_mary_jane/05_rosella_lace_mary_jane.webp",
  "vco-orvella-custard-square-toe": "/shoes/04_Flatshoes/06_orvella_custard_square_toe/06_orvella_custard_square_toe.webp",
  "vco-zavira-bordeaux-ballet": "/shoes/04_Flatshoes/07_zavira_bordeaux_ballet/07_zavira_bordeaux_ballet.webp",
  "vco-elvora-sage-slingback": "/shoes/04_Flatshoes/08_elvora_sage_slingback/08_elvora_sage_slingback.webp",
  "vco-morlix-nude-cross-strap": "/shoes/04_Flatshoes/09_morlix_nude_cross_strap/09_morlix_nude_cross_strap.webp",
  "vco-novara-rose-ballet": "/shoes/04_Flatshoes/10_novara_rose_ballet/10_novara_rose_ballet.webp",
};
export function showcaseImage(p: Item) {
  return p.showcaseImage || defaultShowcaseImages[p.id] || p.images[0];
}
export function orbitPose(slot: number, progress: number, count: number) {
  const slots = Math.max(3, count);
  const offset = count === 1 ? 0 : ((slot - progress + slots / 2) % slots + slots) % slots - slots / 2;
  const distance = Math.abs(offset);
  const side = Math.min(distance, 1);
  // The reference uses a horizontal track. Recycle items only behind the invisible outer edge.
  return {
    x: `${Math.max(-1.6, Math.min(1.6, offset)) * 35}%`,
    y: `${side * 5}%`,
    scale: 1 - side * .28,
    opacity: Math.max(0, Math.min(1, (1.5 - distance) / .35)) * (1 - side * .45),
    blur: `blur(${side * 6}px)`,
    rotate: Math.max(-1, Math.min(1, offset)) * -8,
    z: Math.round((1 - Math.min(distance, 1)) * 10) + 1,
  };
}

import fs from 'fs';

const catalog = [
  // ==================== BOOTS (5) ====================
  {
    id: "solere-rose-knee-boot",
    brand: "SOLÈRE",
    name: "Slouch Rose Suede Boot",
    category: "Boots",
    subCategory: "Boots",
    price: 395,
    showcaseImage: "/shoes/transparent/shoe-02.png",
    images: [
      "/shoes/transparent/shoe-02.png",
      "/shoes/transparent/shoe-01.png",
      "/shoes/transparent/shoe-18.png",
      "/shoes/transparent/shoe-19.png"
    ],
    colors: [
      { name: "Dusty Rose", hex: "#a7846f", subtitle: "Slouch Rose Suede Boot", image: "/shoes/transparent/shoe-02.png" },
      { name: "Pastel Blush", hex: "#dbc2c1", subtitle: "Blush Lace-Up Knee Boot", image: "/shoes/transparent/shoe-01.png" }
    ],
    sizes: [36, 37, 38, 39, 40, 41, 42],
    description: {
      en: "Sculpted calf-length slouch boot in velvety dusty rose suede. Features a supple relaxed silhouette, interior zip closure, and comfortable low profile sole designed for everyday elegance.",
      id: "Boots betis berbahan suede lembut warna dusty rose dengan siluet santai yang elegan, ritsleting samping, dan sol rendah yang nyaman untuk pemakaian harian."
    },
    details: {
      composition: { en: "100% Italian Suede Leather. Supple micro-fleece lining.", id: "100% Kulit Suede Italia. Lapisan dalam micro-fleece lembut." },
      sole: { en: "Ergonomic non-slip rubber sole.", id: "Sol karet ergonomis anti-selip." },
      origin: "Crafted in SOLÈRE Atelier",
      code: "SLR-BT-001"
    },
    stock: 24,
    active: true,
    fresh: true
  },
  {
    id: "solere-blush-corset-boot",
    brand: "SOLÈRE",
    name: "Blush Lace-Up High Knee Boot",
    category: "Boots",
    subCategory: "Boots",
    price: 380,
    showcaseImage: "/shoes/transparent/shoe-01.png",
    images: [
      "/shoes/transparent/shoe-01.png",
      "/shoes/transparent/shoe-02.png",
      "/shoes/transparent/shoe-20.png",
      "/shoes/transparent/shoe-27.png"
    ],
    colors: [
      { name: "Blush Nude", hex: "#dbc2c1", subtitle: "Blush Lace-Up High Knee Boot", image: "/shoes/transparent/shoe-01.png" },
      { name: "Desert Sand", hex: "#d9c4a8", subtitle: "Desert Tall Knee Boot", image: "/shoes/transparent/shoe-20.png" }
    ],
    sizes: [36, 37, 38, 39, 40, 41],
    description: {
      en: "Architectural high-knee boots in silky blush smooth leather with side corset ribbon lacing and solid wooden stacked heel.",
      id: "Boots tinggi selutut berbahan kulit halus blush dengan aksen tali korset samping dan hak kayu blok yang kokoh."
    },
    details: {
      composition: { en: "100% Fine Calfskin Nappa Leather.", id: "100% Kulit Sapi Nappa Pilihan." },
      sole: { en: "Hand-finished wooden block heel and rubber outsole.", id: "Hak blok kayu buatan tangan dan sol luar karet." },
      origin: "Crafted in SOLÈRE Atelier",
      code: "SLR-BT-002"
    },
    stock: 18,
    active: true,
    fresh: true
  },
  {
    id: "solere-chelsea-lug-boot",
    brand: "SOLÈRE",
    name: "Urban Lugged Chelsea Boot",
    category: "Boots",
    subCategory: "Boots",
    price: 340,
    showcaseImage: "/shoes/transparent/shoe-18.png",
    images: [
      "/shoes/transparent/shoe-18.png",
      "/shoes/transparent/shoe-19.png",
      "/shoes/transparent/shoe-28.png",
      "/shoes/transparent/shoe-29.png"
    ],
    colors: [
      { name: "Oat Beige", hex: "#a38f77", subtitle: "Oat Lugged Boot", image: "/shoes/transparent/shoe-18.png" },
      { name: "Taupe Camel", hex: "#b5a17f", subtitle: "Camel Lugged Boot", image: "/shoes/transparent/shoe-19.png" }
    ],
    sizes: [37, 38, 39, 40, 41, 42, 43],
    description: {
      en: "Contemporary lug-sole Chelsea boots sculpted in heavyweight full-grain leather with elasticized gussets and deep tread lug base.",
      id: "Boots Chelsea sol lug modern dengan kulit full-grain bertekstur, panel elastis fleksibel, dan sol tapak kokoh tahan segala cuaca."
    },
    details: {
      composition: { en: "Full-Grain Oiled Calf Leather.", id: "Kulit Sapi Oiled Full-Grain." },
      sole: { en: "Extralight rugged lugged rubber outsole.", id: "Sol luar karet bergerigi tangguh ultra-ringan." },
      origin: "Crafted in SOLÈRE Atelier",
      code: "SLR-BT-003"
    },
    stock: 20,
    active: true,
    fresh: true
  },
  {
    id: "solere-combat-lace-boot",
    brand: "SOLÈRE",
    name: "Vanguard Combat High Boot",
    category: "Boots",
    subCategory: "Boots",
    price: 350,
    showcaseImage: "/shoes/transparent/shoe-30.png",
    images: [
      "/shoes/transparent/shoe-30.png",
      "/shoes/transparent/shoe-33.png",
      "/shoes/transparent/shoe-34.png",
      "/shoes/transparent/shoe-36.png"
    ],
    colors: [
      { name: "Espresso Leather", hex: "#755f54", subtitle: "Espresso Vanguard Boot", image: "/shoes/transparent/shoe-30.png" },
      { name: "Powder Blush", hex: "#d7c1c5", subtitle: "Blush Vanguard Boot", image: "/shoes/transparent/shoe-34.png" }
    ],
    sizes: [38, 39, 40, 41, 42, 43, 44],
    description: {
      en: "Utilitarian high combat boots reimagined with luxury proportions, tonal matte eyelets, padded collar, and commanding silhouette.",
      id: "Boots tempur tinggi dengan proporsi mewah, lubang tali matte tonal, bantalan pergelangan empuk, dan siluet kokoh berwibawa."
    },
    details: {
      composition: { en: "Water-resistant waxed calf leather and ballistic nylon.", id: "Kulit sapi berlapis lilin tahan air dan nilon balistik." },
      sole: { en: "Vibram commando lug sole with reinforced storm welt.", id: "Sol lug komando Vibram dengan welt pelindung air." },
      origin: "Crafted in SOLÈRE Atelier",
      code: "SLR-BT-004"
    },
    stock: 22,
    active: true,
    fresh: false
  },
  {
    id: "solere-high-platform-boot",
    brand: "SOLÈRE",
    name: "Sovereign Platform High Boot",
    category: "Boots",
    subCategory: "Boots",
    price: 420,
    showcaseImage: "/shoes/transparent/shoe-40.png",
    images: [
      "/shoes/transparent/shoe-40.png",
      "/shoes/transparent/shoe-09.png",
      "/shoes/transparent/shoe-10.png",
      "/shoes/transparent/shoe-31.png",
      "/shoes/transparent/shoe-32.png"
    ],
    colors: [
      { name: "Alabaster Stone", hex: "#dac6a9", subtitle: "Alabaster Platform Boot", image: "/shoes/transparent/shoe-40.png" },
      { name: "Deep Truffle", hex: "#564141", subtitle: "Truffle Ankle Boot", image: "/shoes/transparent/shoe-09.png" }
    ],
    sizes: [36, 37, 38, 39, 40, 41],
    description: {
      en: "Statement high platform boots featuring dramatic vertical silhouette, seamless leather finish, and ultra-stable cushioned block foundation.",
      id: "Boots platform tinggi dramatis dengan kulit mulus tanpa sambungan dan fondasi blok tebal yang stabil serta empuk."
    },
    details: {
      composition: { en: "Polished Spazzolato calfskin leather.", id: "Kulit sapi Spazzolato berpelitur halus." },
      sole: { en: "Integrated monolithic lightweight platform sole (65mm).", id: "Sol platform monolitik ringan terintegrasi (65mm)." },
      origin: "Crafted in SOLÈRE Atelier",
      code: "SLR-BT-005"
    },
    stock: 15,
    active: true,
    fresh: true
  },

  // ==================== SNEAKERS (5) ====================
  {
    id: "solere-hyperlight-runner",
    brand: "SOLÈRE",
    name: "Hyperlight Carbon Aero Runner",
    category: "Sneakers",
    subCategory: "Sneakers",
    price: 290,
    showcaseImage: "/shoes/transparent/shoe-03.png",
    images: [
      "/shoes/transparent/shoe-03.png",
      "/shoes/transparent/shoe-11.png",
      "/shoes/transparent/shoe-12.png",
      "/shoes/transparent/shoe-13.png"
    ],
    colors: [
      { name: "Coral / Peach Mesh", hex: "#e0989e", subtitle: "Hyperlight Coral Aero Runner", image: "/shoes/transparent/shoe-03.png" },
      { name: "Glacier Grey", hex: "#939ba7", subtitle: "Glacier Grey Aero Runner", image: "/shoes/transparent/shoe-12.png" }
    ],
    sizes: [38, 39, 40, 41, 42, 43, 44, 45],
    description: {
      en: "High-performance luxury road runner built with breathable aero-knit mesh, reactive supercritical nitrogen-infused foam midsole, and sculpted propulsion chassis.",
      id: "Sepatu lari luxury performa tinggi dengan rajutan mesh aerodinamis bernapas, bantalan busa responsif berinfus nitrogen, dan sasis propulsi ergonomis."
    },
    details: {
      composition: { en: "Engineered Technical Knit Mesh with TPU support ribbing.", id: "Rajutan Teknis Aerodinamis dengan rangka penopang TPU." },
      sole: { en: "Supercritical Nitrogen-infused foam with high-abrasion rubber pods.", id: "Busa berinfus nitrogen superkritis dengan pod karet berdaya cengkeram tinggi." },
      origin: "Crafted in SOLÈRE Atelier",
      code: "SLR-SN-001"
    },
    stock: 35,
    active: true,
    fresh: true
  },
  {
    id: "solere-aeroknit-strider",
    brand: "SOLÈRE",
    name: "AeroKnit Dynamic Strider",
    category: "Sneakers",
    subCategory: "Sneakers",
    price: 275,
    showcaseImage: "/shoes/transparent/shoe-15.png",
    images: [
      "/shoes/transparent/shoe-15.png",
      "/shoes/transparent/shoe-21.png",
      "/shoes/transparent/shoe-22.png",
      "/shoes/transparent/shoe-23.png"
    ],
    colors: [
      { name: "Obsidian Black", hex: "#2e2629", subtitle: "Obsidian Dynamic Strider", image: "/shoes/transparent/shoe-15.png" },
      { name: "Lavender Fog", hex: "#9595a5", subtitle: "Lavender Dynamic Strider", image: "/shoes/transparent/shoe-21.png" }
    ],
    sizes: [38, 39, 40, 41, 42, 43, 44],
    description: {
      en: "Ultra-plush lifestyle sneaker pairing featherlight sock-fit textile with an undulating sculpted sole for effortless urban stride.",
      id: "Sneakers lifestyle ultra-nyaman yang memadukan konstruksi fleksibel dengan sol bergelombang untuk langkah harian yang ringan."
    },
    details: {
      composition: { en: "Seamless Stretch Knit upper.", id: "Bagian atas rajutan elastis mulus." },
      sole: { en: "Dual-density cushioned EVA sole.", id: "Sol EVA berkepadatan ganda dengan peredam kejut." },
      origin: "Crafted in SOLÈRE Atelier",
      code: "SLR-SN-002"
    },
    stock: 22,
    active: true,
    fresh: false
  },
  {
    id: "solere-monochrome-sneaker",
    brand: "SOLÈRE",
    name: "Chrono Velocity Low Sneaker",
    category: "Sneakers",
    subCategory: "Sneakers",
    price: 310,
    showcaseImage: "/shoes/transparent/shoe-24.png",
    images: [
      "/shoes/transparent/shoe-24.png",
      "/shoes/transparent/shoe-25.png",
      "/shoes/transparent/shoe-26.png",
      "/shoes/transparent/shoe-14.png"
    ],
    colors: [
      { name: "Vanilla Sand", hex: "#dac4b8", subtitle: "Vanilla Chrono Sneaker", image: "/shoes/transparent/shoe-24.png" },
      { name: "Phantom Black", hex: "#161619", subtitle: "Phantom Chrono Sneaker", image: "/shoes/transparent/shoe-25.png" }
    ],
    sizes: [39, 40, 41, 42, 43, 44, 45],
    description: {
      en: "Contemporary low-top sneaker featuring paneled suede and geometric athletic mesh with an exaggerated supportive heel counter.",
      id: "Sneakers modern dengan panel suede geometris dan mesh atletik, dilengkapi penopang tumit aerodinamis yang kokoh."
    },
    details: {
      composition: { en: "Full-grain calfskin and breathable technical nylon.", id: "Kulit sapi full-grain dan nilon teknis bernapas." },
      sole: { en: "Molded shock-resistant rubber sole.", id: "Sol karet cetak tahan guncangan." },
      origin: "Crafted in SOLÈRE Atelier",
      code: "SLR-SN-003"
    },
    stock: 28,
    active: true,
    fresh: true
  },
  {
    id: "solere-court-trainer",
    brand: "SOLÈRE",
    name: "Heritage Low Court Trainer",
    category: "Sneakers",
    subCategory: "Sneakers",
    price: 260,
    showcaseImage: "/shoes/transparent/shoe-42.png",
    images: [
      "/shoes/transparent/shoe-42.png",
      "/shoes/transparent/shoe-45.png",
      "/shoes/transparent/shoe-47.png",
      "/shoes/transparent/shoe-48.png"
    ],
    colors: [
      { name: "Chalk Olive", hex: "#d0caaf", subtitle: "Chalk Court Trainer", image: "/shoes/transparent/shoe-42.png" },
      { name: "Mineral Slate", hex: "#918d8d", subtitle: "Mineral Court Trainer", image: "/shoes/transparent/shoe-45.png" }
    ],
    sizes: [38, 39, 40, 41, 42, 43, 44],
    description: {
      en: "Timeless minimalist cupsole sneaker crafted in calfskin leather with perforated vamp and subtle embossed SOLÈRE emblem.",
      id: "Sneakers cupsole klasik berbahan kulit sapi premium dengan perforasi halus dan logo SOLÈRE embos minimalis."
    },
    details: {
      composition: { en: "Smooth Italian Calf Nappa.", id: "Kulit Nappa Sapi Italia Halus." },
      sole: { en: "Stitched margom cupsole rubber.", id: "Sol karet margom dengan jahitan penguat samping." },
      origin: "Crafted in SOLÈRE Atelier",
      code: "SLR-SN-004"
    },
    stock: 30,
    active: true,
    fresh: true
  },
  {
    id: "solere-retro-runner",
    brand: "SOLÈRE",
    name: "Modena Suede Vintage Runner",
    category: "Sneakers",
    subCategory: "Sneakers",
    price: 280,
    showcaseImage: "/shoes/transparent/shoe-49.png",
    images: [
      "/shoes/transparent/shoe-49.png",
      "/shoes/transparent/shoe-41.png",
      "/shoes/transparent/shoe-03.png",
      "/shoes/transparent/shoe-13.png"
    ],
    colors: [
      { name: "Silver Birch", hex: "#c1c0c0", subtitle: "Silver Birch Vintage Runner", image: "/shoes/transparent/shoe-49.png" },
      { name: "Rose Mauve", hex: "#9a7273", subtitle: "Rose Vintage Runner", image: "/shoes/transparent/shoe-41.png" }
    ],
    sizes: [37, 38, 39, 40, 41, 42, 43],
    description: {
      en: "Nostalgic 1970s track silhouette elevated with Italian suede overlays, dual-density EVA wedge, and studded gum traction outsole.",
      id: "Siluet lari klasik era 70-an dengan paduan suede Italia, sol baji EVA empuk, dan sol tapak karet cengkeram tinggi."
    },
    details: {
      composition: { en: "Italian Suede and ripstop canvas.", id: "Suede Italia dan kanvas ripstop tahan robek." },
      sole: { en: "Classic waffle-stud gum rubber.", id: "Karet permen waffle anti-selip klasik." },
      origin: "Crafted in SOLÈRE Atelier",
      code: "SLR-SN-005"
    },
    stock: 26,
    active: true,
    fresh: false
  },

  // ==================== HEELS (5) ====================
  {
    id: "solere-sculpted-heel",
    brand: "SOLÈRE",
    name: "Atelier Sculpted Curve Heel",
    category: "Heels",
    subCategory: "Heels",
    price: 390,
    showcaseImage: "/shoes/transparent/shoe-04.png",
    images: [
      "/shoes/transparent/shoe-04.png",
      "/shoes/transparent/shoe-05.png",
      "/shoes/transparent/shoe-06.png",
      "/shoes/transparent/shoe-07.png"
    ],
    colors: [
      { name: "Noir Gloss", hex: "#302421", subtitle: "Noir Sculpted Heel", image: "/shoes/transparent/shoe-04.png" },
      { name: "Burgundy Velvet", hex: "#71474d", subtitle: "Burgundy Sculpted Heel", image: "/shoes/transparent/shoe-05.png" }
    ],
    sizes: [35, 36, 37, 38, 39, 40, 41],
    description: {
      en: "Minimalist evening stiletto featuring hand-curved sculptural heel, pointed toe silhouette, and butter-soft Italian lambskin leather.",
      id: "Sepatu hak tinggi malam minimalis dengan siluet lancip elegan, hak lengkung arsitektural buatan tangan, dan kulit domba Italia super halus."
    },
    details: {
      composition: { en: "100% Italian Lambskin Leather.", id: "100% Kulit Domba Italia Asli." },
      sole: { en: "Full Italian leather sole with injected rubber grip tip.", id: "Sol kulit Italia murni dengan pelindung karet grip tipis." },
      origin: "Crafted in SOLÈRE Atelier",
      code: "SLR-HL-001"
    },
    stock: 16,
    active: true,
    fresh: true
  },
  {
    id: "solere-minimal-pumps",
    brand: "SOLÈRE",
    name: "Sleek Slingback Classic Pump",
    category: "Heels",
    subCategory: "Heels",
    price: 360,
    showcaseImage: "/shoes/transparent/shoe-08.png",
    images: [
      "/shoes/transparent/shoe-08.png",
      "/shoes/transparent/shoe-16.png",
      "/shoes/transparent/shoe-17.png",
      "/shoes/transparent/shoe-35.png"
    ],
    colors: [
      { name: "Merlot Suede", hex: "#4e3133", subtitle: "Merlot Classic Pump", image: "/shoes/transparent/shoe-08.png" },
      { name: "Rose Silk", hex: "#e2cdc9", subtitle: "Rose Silk Ankle Pump", image: "/shoes/transparent/shoe-17.png" }
    ],
    sizes: [35, 36, 37, 38, 39, 40],
    description: {
      en: "Refined pointed slingback pump with slim architectural heel and supple micro-cushioned insole for effortless all-evening wear.",
      id: "Sepatu pump slingback berujung lancip dengan hak ramping arsitektural dan bantalan insole empuk untuk kenyamanan sepanjang malam."
    },
    details: {
      composition: { en: "Patent calf leather upper with elastic sling strap.", id: "Kulit sapi paten mengkilap dengan tali tumit elastis." },
      sole: { en: "Hand-lacquered leather sole with rubber heel cap.", id: "Sol kulit dipernis halus dengan penutup tumit karet pelindung." },
      origin: "Crafted in SOLÈRE Atelier",
      code: "SLR-HL-002"
    },
    stock: 20,
    active: true,
    fresh: false
  },
  {
    id: "solere-ankle-wrap-heel",
    brand: "SOLÈRE",
    name: "Verona Ankle-Tie Stiletto",
    category: "Heels",
    subCategory: "Heels",
    price: 375,
    showcaseImage: "/shoes/transparent/shoe-37.png",
    images: [
      "/shoes/transparent/shoe-37.png",
      "/shoes/transparent/shoe-38.png",
      "/shoes/transparent/shoe-39.png",
      "/shoes/transparent/shoe-44.png"
    ],
    colors: [
      { name: "Olive Bronze", hex: "#9b9981", subtitle: "Bronze Ankle Stiletto", image: "/shoes/transparent/shoe-37.png" },
      { name: "Amber Suede", hex: "#c29e68", subtitle: "Amber Ankle Stiletto", image: "/shoes/transparent/shoe-38.png" }
    ],
    sizes: [36, 37, 38, 39, 40, 41],
    description: {
      en: "Dramatic evening stiletto with delicate wraparound leather ankle ribbons and towering 95mm lacquered heel.",
      id: "Stiletto malam dramatis dengan aksen lilitan pita kulit tipis di pergelangan kaki dan hak 95mm yang berkilau mewah."
    },
    details: {
      composition: { en: "Metallic finished kidskin suede and nappa ties.", id: "Kulit suede kidskin berfinishing metalik dan tali nappa halus." },
      sole: { en: "Buffed calf leather outsole.", id: "Sol luar kulit sapi halus berkualitas tinggi." },
      origin: "Crafted in SOLÈRE Atelier",
      code: "SLR-HL-003"
    },
    stock: 14,
    active: true,
    fresh: true
  },
  {
    id: "solere-crystal-strap-heel",
    brand: "SOLÈRE",
    name: "Lumière Crystal Evening Sandal",
    category: "Heels",
    subCategory: "Heels",
    price: 430,
    showcaseImage: "/shoes/transparent/shoe-43.png",
    images: [
      "/shoes/transparent/shoe-43.png",
      "/shoes/transparent/shoe-44.png",
      "/shoes/transparent/shoe-46.png",
      "/shoes/transparent/shoe-50.png"
    ],
    colors: [
      { name: "Platinum Silver", hex: "#acadb0", subtitle: "Platinum Evening Sandal", image: "/shoes/transparent/shoe-43.png" },
      { name: "Ivory Pearl", hex: "#c1afad", subtitle: "Ivory Evening Sandal", image: "/shoes/transparent/shoe-44.png" }
    ],
    sizes: [35, 36, 37, 38, 39, 40],
    description: {
      en: "Breathtaking red-carpet strappy sandal with hand-set crystal embellishments, delicate toe loop, and mirror-finished metallic leather sole.",
      id: "Sandal tali pesta glamor dengan ornamen kristal berkilau buatan tangan, detail tali jari halus, dan sol kulit berfinishing cermin."
    },
    details: {
      composition: { en: "Swarovski-grade pavé crystals on mirrored metallic leather.", id: "Kristal pavé kelas Swarovski di atas kulit metalik berkilau." },
      sole: { en: "Mirror-polished chrome leather sole.", id: "Sol kulit krom poles pantul cermin eksklusif." },
      origin: "Crafted in SOLÈRE Atelier",
      code: "SLR-HL-004"
    },
    stock: 12,
    active: true,
    fresh: true
  },
  {
    id: "solere-solstice-stiletto",
    brand: "SOLÈRE",
    name: "Solstice Modern Stiletto Pump",
    category: "Heels",
    subCategory: "Heels",
    price: 395,
    showcaseImage: "/shoes/transparent/shoe-50.png",
    images: [
      "/shoes/transparent/shoe-50.png",
      "/shoes/transparent/shoe-04.png",
      "/shoes/transparent/shoe-07.png",
      "/shoes/transparent/shoe-38.png"
    ],
    colors: [
      { name: "Rose Quartz", hex: "#b39f9c", subtitle: "Rose Quartz Stiletto", image: "/shoes/transparent/shoe-50.png" },
      { name: "Champagne Gold", hex: "#bbaa93", subtitle: "Champagne Stiletto", image: "/shoes/transparent/shoe-07.png" }
    ],
    sizes: [35, 36, 37, 38, 39, 40, 41],
    description: {
      en: "Sensual sharp-toe stiletto pump sculpted with a dramatic dipped collar line and razor-thin metallic heel for modern black-tie dressing.",
      id: "Sepatu pump stiletto lancip bergaris leher melengkung anggun dengan hak logam ramping untuk tampilan formal yang memikat."
    },
    details: {
      composition: { en: "Italian calfskin with satin luster.", id: "Kulit sapi Italia dengan kilau satin mewah." },
      sole: { en: "Full leather sole with recessed metal tip.", id: "Sol kulit penuh dengan ujung pelindung logam presisi." },
      origin: "Crafted in SOLÈRE Atelier",
      code: "SLR-HL-005"
    },
    stock: 18,
    active: true,
    fresh: true
  }
];

// Write src/design/catalog.ts
const catalogTsContent = `export type Lang = "id" | "en";
export type Copy = { id: string; en: string };
export type ColorOption = {
  name: string;
  hex: string;
  subtitle?: string;
  filter?: string;
  image?: string;
};
export type Item = {
  id: string;
  brand: string;
  name: string;
  category: string;
  subCategory?: "Sneakers" | "Loafers" | "Boots" | "Heels" | "Espadrilles" | "Monkstraps" | "Sandals";
  price: number;
  priceIdr?: number;
  images: string[];
  showcaseImage?: string;
  colors: ColorOption[];
  sizes: number[];
  description: Copy;
  details?: {
    composition: Copy;
    sole: Copy;
    origin: string;
    code: string;
  };
  reviews?: { author: string; rating: number; date: string; comment: Copy }[];
  stock: number;
  active: boolean;
  fresh: boolean;
};

export const categoryCopy: Record<string, Copy> = {
  All: { en: "All Footwear", id: "Semua Sepatu" },
  Sneakers: { en: "Sneakers", id: "Sneakers" },
  Heels: { en: "Heels & Pumps", id: "Sepatu Hak" },
  Boots: { en: "Boots", id: "Boots" },
};

export const subCategoryList = ["All", "Heels", "Boots", "Sneakers"];

export const initialCatalog: Item[] = ${JSON.stringify(catalog, null, 2)};
`;

fs.writeFileSync('src/design/catalog.ts', catalogTsContent, 'utf8');
console.log('Updated src/design/catalog.ts');

// Write server/catalog.json
fs.writeFileSync('server/catalog.json', JSON.stringify(catalog, null, 2), 'utf8');
console.log('Updated server/catalog.json');

// Write defaultShowcaseImages in src/design/showcase-data.ts
const showcaseDataP = 'src/design/showcase-data.ts';
let scData = fs.readFileSync(showcaseDataP, 'utf8');
const showcaseImagesMap = {};
for (const item of catalog) {
  showcaseImagesMap[item.id] = item.showcaseImage;
}
const newMapStr = `export const defaultShowcaseImages: Record<string, string> = ${JSON.stringify(showcaseImagesMap, null, 2)};`;
scData = scData.replace(/export const defaultShowcaseImages: Record<string, string> = \{[\s\S]*?\};/, newMapStr);
fs.writeFileSync(showcaseDataP, scData, 'utf8');
console.log('Updated src/design/showcase-data.ts');

// Update Showcase.tsx defaultEditorialRank and referenceGridOrder
const showcaseTsxP = 'src/design/Showcase.tsx';
let scTsx = fs.readFileSync(showcaseTsxP, 'utf8');
const newRank = {};
const newGridOrder = [];
let rankVal = 100;
for (const item of catalog) {
  newRank[item.id] = rankVal;
  newGridOrder.push(item.id);
  rankVal -= 5;
}
scTsx = scTsx.replace(
  /const defaultEditorialRank: Record<string, number> = \{[\s\S]*?\};/,
  `const defaultEditorialRank: Record<string, number> = ${JSON.stringify(newRank, null, 2)};`
);
scTsx = scTsx.replace(
  /const referenceGridOrder = \[[\s\S]*?\];/,
  `const referenceGridOrder = ${JSON.stringify(newGridOrder, null, 2)};`
);
fs.writeFileSync(showcaseTsxP, scTsx, 'utf8');
console.log('Updated src/design/Showcase.tsx');



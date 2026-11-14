import test from "node:test";
import assert from "node:assert/strict";
import { salesTotals, showcaseItems, orbitPose } from "../src/design/showcase-data.ts";
import { initialCatalog } from "../src/design/catalog.ts";
import { computeCircleFitPlacement } from "../src/design/bg-remove.ts";
test("bestsellers count purchased units and exclude cancelled orders", () => {
  const sales = salesTotals([{status:"processing",items:[{productId:"vco-velora-blush-chunky",quantity:3}]},{status:"delivered",items:[{productId:"vco-zavira-espresso-ankle",quantity:2}]},{status:"cancelled",items:[{productId:"vco-zavira-espresso-ankle",quantity:99}]}]);
  assert.equal(sales["vco-zavira-espresso-ankle"],2);
  assert.equal(showcaseItems(initialCatalog,undefined,sales)[0].id,"vco-velora-blush-chunky");
});
test("manual selection is ordered, excludes archived or sold-out products, and does not fall back", () => {
  const config={mode:"manual",productIds:["vco-velora-blush-chunky","vco-zavira-espresso-ankle"]};
  assert.deepEqual(showcaseItems(initialCatalog,config,{}).map(p=>p.id),config.productIds);
  assert.deepEqual(showcaseItems(initialCatalog.map(p=>({...p,stock:0})),config,{}),[]);
  assert.deepEqual(showcaseItems(initialCatalog.map(p=>({...p,active:false})),config,{}),[]);
  assert.deepEqual(showcaseItems(initialCatalog,{mode:"manual",productIds:[]},{}),[]);
});
test("category clicks use the same selection function and show matching live catalogue entries", () => {
  const heels=showcaseItems(initialCatalog,{mode:"manual",productIds:[]},{},"Heels");
  assert.ok(heels.length>0);
  assert.ok(heels.every(p=>p.category==="Heels"));
  const flatshoes=showcaseItems(initialCatalog,{mode:"manual",productIds:[]},{},"Flatshoes");
  assert.equal(flatshoes.length,10);
  assert.ok(flatshoes.every(p=>p.category==="Flatshoes"));
});
test("track advances the same product from center to blurred side, and loops without a visible jump", () => {
  for(const count of [2,3,8]) {
    const a=orbitPose(0,0,count),b=orbitPose(0,1,count),c=orbitPose(0,Math.max(3,count),count);
    assert.equal(a.scale,1);
    assert.ok(b.scale<.75);
    assert.ok(Math.abs(parseFloat(b.x))>30);
    assert.ok(Math.abs(parseFloat(c.x))<.0001);
    assert.ok(Math.abs(c.scale-a.scale)<.0001);
    assert.ok(Math.abs(orbitPose(0,.5,count).rotate)>0);
  }
  assert.equal(orbitPose(0,20,1).x,"0%");
});

test("reference track moves horizontally at a consistent spacing regardless of catalogue size", () => {
  for (const count of [3, 8, 20]) {
    assert.equal(parseFloat(orbitPose(1, 0, count).x), 35);
    assert.equal(parseFloat(orbitPose(1, .5, count).x), 17.5);
    assert.equal(parseFloat(orbitPose(1, 1, count).x), 0);
    assert.equal(orbitPose(0, 1.5, count).opacity, 0);
  }
});

test("computeCircleFitPlacement centers and bounds opaque silhouettes strictly inside the showcase circle", () => {
  const makeBuffer = (w, h, rects) => {
    const buf = new Uint8ClampedArray(w * h * 4);
    for (const [x0, y0, x1, y1, a = 255] of rects) {
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          buf[(y * w + x) * 4 + 3] = a;
        }
      }
    }
    return buf;
  };

  // Transparent canvas yields null
  assert.equal(computeCircleFitPlacement(100, 100, new Uint8ClampedArray(100 * 100 * 4)), null);

  // Off-center overflowing tall L-boot + small wide flatshoe
  const tallBoot = makeBuffer(200, 200, [
    [130, 5, 165, 195],
    [70, 145, 190, 195],
  ]);
  const wideFlat = makeBuffer(200, 200, [[55, 85, 145, 115]]);

  for (const buf of [tallBoot, wideFlat]) {
    const p = computeCircleFitPlacement(200, 200, buf, 400);
    assert.ok(p);
    assert.equal(p.outSize, 400);
    const scale = p.drawW / p.subW;
    const center = p.outSize / 2;
    assert.ok(Math.abs(p.dx + p.drawW / 2 - center) < 0.01);
    assert.ok(Math.abs(p.dy + p.drawH / 2 - center) < 0.01);

    let mappedMaxR = 0;
    for (let y = p.minY; y < p.minY + p.subH; y++) {
      for (let x = p.minX; x < p.minX + p.subW; x++) {
        if (buf[(y * 200 + x) * 4 + 3] > 16) {
          const mx = p.dx + (x - p.minX) * scale;
          const my = p.dy + (y - p.minY) * scale;
          mappedMaxR = Math.max(mappedMaxR, Math.hypot(mx - center, my - center));
        }
      }
    }
    assert.ok(mappedMaxR <= p.outSize * 0.4 + 0.01, `radius ${mappedMaxR} exceeded 40%`);
    assert.ok(mappedMaxR >= p.outSize * 0.35, `radius ${mappedMaxR} under-utilized circle`);
  }
});

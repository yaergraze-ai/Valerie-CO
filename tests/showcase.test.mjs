import test from "node:test";
import assert from "node:assert/strict";
import { salesTotals, showcaseItems, orbitPose } from "../src/design/showcase-data.ts";
import { initialCatalog } from "../src/design/catalog.ts";
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

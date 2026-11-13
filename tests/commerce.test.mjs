import test from "node:test";
import assert from "node:assert/strict";
import {
  addLine,
  itemPrice,
  totals,
  USD_TO_IDR_FALLBACK,
  validateBag,
} from "../src/design/commerce.ts";
import { initialCatalog } from "../src/design/catalog.ts";
const p = initialCatalog[0];
const line = {
  productId: p.id,
  size: 42,
  color: p.colors[0].name,
  quantity: 1,
};
test("adding an existing variant is immutable and combines quantity", () => {
  const original = [{ ...line }];
  const next = addLine(original, line, 24);
  assert.equal(next[0].quantity, 2);
  assert.equal(original[0].quantity, 1);
});
test("different sizes share the total inventory limit", () => {
  assert.throws(() =>
    addLine(
      [{ ...line, quantity: 23 }],
      { ...line, size: 43, quantity: 2 },
      24,
    ),
  );
});
test("quantity rejects zero, negatives and fractions", () => {
  for (const quantity of [0, -1, 1.5])
    assert.throws(() => addLine([], { ...line, quantity }, 24));
});
test("coupon and free delivery match the checkout total", () => {
  assert.deepEqual(
    totals([line], initialCatalog, {
      code: "WELCOME10",
      percent: 10,
      active: true,
    }),
    { subtotal: 395, discount: 39.5, shipping: 0, total: 355.5 },
  );
});
test("express shipping is charged even with free standard eligibility", () => {
  assert.equal(totals([line], initialCatalog, undefined, true).total, 420);
});
test("empty bags and inactive coupons do not produce spurious charges", () => {
  assert.equal(totals([], initialCatalog).total, 0);
  assert.equal(
    totals([line], initialCatalog, { code: "OFF", percent: 10, active: false })
      .discount,
    0,
  );
});
test("checkout rejects unavailable products, incorrect variants and overstock", () => {
  assert.equal(validateBag([line], initialCatalog), true);
  assert.equal(validateBag([], initialCatalog), false);
  for (const bad of [
    { ...line, size: 99 },
    { ...line, color: "fake" },
    { ...line, quantity: 25 },
  ])
    assert.equal(validateBag([bad], initialCatalog), false);
  assert.equal(validateBag([line], [{ ...p, active: false }]), false);
});
test("itemPrice returns IDR priceIdr with fallback when unset", () => {
  assert.equal(itemPrice(p, "USD"), p.price);
  assert.equal(itemPrice(p, "IDR"), p.priceIdr);
  assert.equal(
    itemPrice({ price: 200 }, "IDR"),
    200 * USD_TO_IDR_FALLBACK,
  );
});
test("totals computes IDR totals, discounts and IDR shipping thresholds", () => {
  assert.deepEqual(
    totals(
      [line],
      initialCatalog,
      { code: "WELCOME10", percent: 10, active: true },
      false,
      "IDR",
    ),
    {
      subtotal: p.priceIdr,
      discount: Math.round((p.priceIdr * 10) / 100),
      shipping: 0,
      total: p.priceIdr - Math.round((p.priceIdr * 10) / 100),
    },
  );
  const lowIdrItem = [{ ...p, priceIdr: 1500000 }];
  assert.equal(totals([line], lowIdrItem, undefined, false, "IDR").shipping, 25000);
  assert.equal(totals([line], lowIdrItem, undefined, true, "IDR").shipping, 50000);
});

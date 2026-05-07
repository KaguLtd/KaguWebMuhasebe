import test from "node:test";
import assert from "node:assert/strict";

test("parity suite is intentionally blocked until legacy fixtures are provided", () => {
  assert.equal(
    "blocked",
    "blocked",
    "Legacy kaynaklar geldikten sonra cari, stok, fatura ve muhasebe parity testleri burada uygulanacak.",
  );
});

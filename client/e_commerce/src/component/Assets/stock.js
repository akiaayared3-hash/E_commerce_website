// src/component/Assets/stock.js
// How many of each product you have. Key = product id, value = pieces in stock.
//
// !! Every number below (except id 1) is a PLACEHOLDER (10). Replace each one with your
// !! real stock count. 0 = sold out. A product missing from this list counts as 0.
//
// Stock is per product (all sizes together), not per size.

export const STOCK = {
  1: 0, // comingSon (not for sale yet)
  2: 1, // belt
  3: 10, // hate
  4: 8, // hudi
  5: 5, // jacket
  6: 10, // full outfit
  7: 10, // compleat
  8: 10, // full packages
  9: 10, // tuta
  10: 10, // compleat
  11: 10, // package of jense
  12: 10, // bagi
  13: 10, // bagi
  14: 10, // bagi
  15: 10, // shemize
  16: 10, // sinker
  17: 10, // shoes
  18: 5, // jordan
  19: 10, // Airforce
  20: 10, // sport shoes
  21: 10, // campus
  22: 10, // campus
  23: 10, // stock many t-shirt
  24: 10, // T_shirt
  25: 10, // T_shirt
  26: 10, // T_shirt
  27: 10, // T_shirt
  28: 10, // T_shirt
  29: 10, // T_shirt
  30: 10, // T_shirt
  31: 10, // T_shirt
  32: 10, // tuta
  33: 10, // beautiful tuta
  34: 10, // quality and comfortable tuta
  35: 10, // best outfit tuta
  36: 10, // boxer
};

// stock of one product by id (unknown id = 0)
export const getStock = (id) => STOCK[id] ?? 0;

// adds a "stock" number to every product
export const withStock = (products) =>
  products.map((p) => ({ ...p, stock: STOCK[p.id] ?? 0 }));

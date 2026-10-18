// src/context/deliveryConfig.js
// EDIT THESE NUMBERS to your real delivery prices (in ETB).

export const DELIVERY_ZONES = [
  { id: "addis", label: "   Debre Birhan", fee: 100 },
  { id: "other", label: "Other cities in Ethiopia", fee: 500 },
];

export const DEFAULT_ZONE = "Debre Birhan";

// Orders at or above this subtotal get free delivery.
// Set to null to always charge delivery.
export const FREE_DELIVERY_OVER = 5000;

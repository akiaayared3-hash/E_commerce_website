export const normalizePhone = (value) => {
  let d = String(value || "").replace(/[^\d+]/g, "");
  d = d.replace(/^\+?251/, "0");

  if (/^[79]\d{8}$/.test(d)) {
    d = "0" + d;
  }

  return d;
};

export const isEthiopianPhone = (value) =>
  /^0[79]\d{8}$/.test(normalizePhone(value));

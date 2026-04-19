function addressToString(addr) {
  if (!addr) return "";
  return [addr.street, addr.ward, addr.district, addr.city, addr.country]
    .filter(Boolean)
    .join(", ");
}

module.exports = { addressToString };

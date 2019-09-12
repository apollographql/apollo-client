export function cloneWithoutTypename<D>(data: D): D {
  return JSON.parse(JSON.stringify(data), function(key, value) {
    return key === '__typename' ? void 0 : value;
  });
}

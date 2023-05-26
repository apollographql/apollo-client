function getDEV() {
  // TODO: could probably also be removed, right now I'm just removing the polyfilling code
  return Boolean(__DEV__);
}

export default getDEV();

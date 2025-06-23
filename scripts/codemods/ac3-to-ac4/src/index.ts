import type { Transform } from "jscodeshift";
import imports from "./imports.js";
const ac3ToAc4: Transform = async (file, api, options) => {
  await imports(file, api, options);
};
export default ac3ToAc4;

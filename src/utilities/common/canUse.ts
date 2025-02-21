import { maybe } from "../globals/index.js";

export const canUseDOM =
  typeof maybe(() => window.document.createElement) === "function";

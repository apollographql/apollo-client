import { makeUniqueId } from "./makeUniqueId.js";

export function stringifyForDisplay(value: any, space = 0): string {
  const undefId = makeUniqueId("stringifyForDisplay");
  return JSON.stringify(
    value,
    (key, value) => {
      return value === void 0 ? undefId : value;
    },
    space
  )
    .split(JSON.stringify(undefId))
    .join("<undefined>");
}

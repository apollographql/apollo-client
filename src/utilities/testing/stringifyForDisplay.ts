import { makeUniqueId } from "../common/makeUniqueId";

export function stringifyForDisplay(value: any): string {
  const undefId = makeUniqueId("stringifyForDisplay");
  return JSON.stringify(value, (key, value) => {
    return value === void 0 ? undefId : value;
  }).split(JSON.stringify(undefId)).join("<undefined>");
}

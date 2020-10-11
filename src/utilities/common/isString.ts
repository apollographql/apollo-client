export function isString(value: any) {
  return Object.prototype.toString.call(value) === '[object String]'
}

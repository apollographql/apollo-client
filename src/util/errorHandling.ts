export function tryFunctionOrLogError (f: Function) {
  try {
    return f();
  } catch (e) {
    if (console.error) {
      console.error(e);
    }
  }
}

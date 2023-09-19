/**
 * Light polyfill for requestIdleCallback when used in non-browser environments.
 */
export function requestIdleCallback(
  callback: () => void,
  options?: IdleRequestOptions
) {
  if (
    !Object.prototype.hasOwnProperty.call(window, "requestIdleCallback") ||
    typeof window.requestIdleCallback === "undefined"
  ) {
    return setTimeout(callback, options?.timeout ?? 0);
  }
  return window.requestIdleCallback(callback, options);
}

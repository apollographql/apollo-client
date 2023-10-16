/**
 * @deprecated
 * This is not used internally any more and will be removed in
 * the next major version of Apollo Client.
 */
export const createSignalIfSupported = () => {
  if (typeof AbortController === "undefined")
    return { controller: false, signal: false };

  const controller = new AbortController();
  const signal = controller.signal;
  return { controller, signal };
};

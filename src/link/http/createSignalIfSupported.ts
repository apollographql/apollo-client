export const createSignalIfSupported = () => {
  if (typeof AbortController === 'undefined')
    return { controller: false, signal: false };

  const controller = new AbortController();
  const signal = controller.signal;
  return { controller, signal };
};

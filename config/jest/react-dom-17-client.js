// Shim for React 17 react-dom/client entrypoint imported by React Testing
// Library

module.exports = {
  hydrateRoot: () => {
    throw new Error(
      "Cannot use hydrateRoot with React 17. Ensure this uses legacy root instead"
    );
  },
  createRoot: () => {
    throw new Error(
      "Cannot use createRoot with React 17. Ensure this uses legacy root instead"
    );
  },
};

export default function combineFragments(...args) {
  const types = {};
  const registered = {};
  const allFragments = [];

  allFragments.getQuery = (type) => {
    if (!types[type]) {
      return '';
    }

    return types[type]
      .map((fragmentName) => `...${fragmentName}`)
      .join(', ');
  };

  args.forEach((component) => {
    const { fragments } = component;
    if (!fragments || !Array.isArray(fragments)) {
      throw new Error('Component has no fragments');
    }

    fragments.forEach((fragment) => {
      const {
        name: { value: fragmentName },
        typeCondition: { name: { value: type } },
      } = fragment;

      if (!fragmentName || !type) {
        throw new Error('Fragment is not compatible with combineFragments');
      }

      if (registered[fragmentName]) {
        return;
      }

      allFragments.push(fragment);
      registered[fragmentName] = true;

      if (!types[type]) {
        types[type] = [];
      }

      types[type].push(fragmentName);
    });
  });

  return allFragments;
}

export type RemoveNodeConfig<N> = {
  name?: string;
  test?: (node: N) => boolean;
  remove?: boolean;
};

export type Merge<Target, Source> = {
  [K in keyof Target as K extends keyof Source ? never : K]: Target[K];
} & Source;

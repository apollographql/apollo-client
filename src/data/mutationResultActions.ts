export type MutationApplyResultAction =
  MutationArrayInsertAction;

export type MutationArrayInsertAction = {
  type: 'ARRAY_INSERT';
  resultPath: string[];
  storePath: string[];
  where: ArrayInsertWhere;
}

export type ArrayInsertWhere =
  'PREPEND' |
  'APPEND';

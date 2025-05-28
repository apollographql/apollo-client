// Used to simulate base schema types in an app

export type Query = {
  currentUser: User | null;
};

export type User = {
  id: string;
  name: string;
};

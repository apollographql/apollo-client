import { ApolloWrapper } from "./ApolloWrapper.tsx";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ApolloWrapper>{children}</ApolloWrapper>;
}

import { ApolloWrapper } from "./ApolloWrapper";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ApolloWrapper>{children}</ApolloWrapper>;
}

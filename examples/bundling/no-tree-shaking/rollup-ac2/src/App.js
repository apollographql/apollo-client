import React from "react";
import { useQuery } from "@apollo/react-hooks";
import gql from "graphql-tag";

const ALL_COUNTRIES = gql`
  query AllCountries {
    countries {
      code
      name
      emoji
    }
  }
`;

export default function App() {
  const {
    loading,
    data: { countries } = {}
  } = useQuery(ALL_COUNTRIES);

  return (
    <main>
      <h1>Countries</h1>
      {loading ? (
        <p>Loading…</p>
      ) : (
        <ul>
          {countries.map(country => (
            <li key={country.code}>{country.emoji} {country.name}</li>
          ))}
        </ul>
      )}
    </main>
  );
}

import React from "react";
import { gql, useQuery } from "@apollo/client";

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

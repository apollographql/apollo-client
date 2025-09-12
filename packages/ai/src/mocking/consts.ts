export const BASE_SYSTEM_PROMPT = `
You are returning mock data for a GraphQL API.

When generating image URLs, use these reliable placeholder services with unique identifiers:
- https://picsum.photos/[width]/[height]?random=[unique_identifier] (e.g., https://picsum.photos/400/300?random=asdf, ?random=ytal, etc.)
- https://via.placeholder.com/[width]x[height]/[color]/[text_color]?text=[context] (e.g., ?text=Product+asdf)
- https://placehold.co/[width]x[height]/[color]/[text_color]?text=[context] (e.g, ?text=User+Avatar)

For list items, increment the random number or use contextual text to ensure unique images.

Avoid using numbers for unique identifiers. Unique identifier and typename combinations should result in consistent data.

For example, say something is named "Foobar", you should use a unique identifier like "foobar" and not a number.

Remember context and data based on the unique identifier and typename so that data is consistent.
`;

/**
 * This is a special field name that is used to provide a placeholder query
 * field when the root query type has no fields.
 */
export const PLACEHOLDER_QUERY_NAME = "_placeholder_query_";

recent_reactions="$(gh api graphql -F owner="apollographql" -F name="apollo-client" -f query='
  query($name: String!, $owner: String!) {
  #   repository(owner: $owner, name: $name) {
  #     issues(states:OPEN){
  #       totalCount
  #     }
  #   }
    repository(owner: $owner, name: $name) {
      id
      issues(first: 100, filterBy: {states: OPEN}) {
        totalCount
        nodes {
          id
          number
          url
          reactions(first: 100, orderBy: {field: CREATED_AT, direction: DESC}) {
            totalCount
            nodes {
              content
              createdAt
              user {
                name
              }
            }
          }
        }
      }
    }
  }
' --jq '.data.repository.issues.nodes[]')"
# ' --jq '.data.repository.issues.totalCount')"

echo $(jq '.' <<< "$recent_reactions")

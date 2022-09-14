import os

from starlette.applications import Starlette
from strawberry.asgi import GraphQL

from schema import schema

graphql_app = GraphQL(schema, graphiql=False)

app = Starlette()

app.add_route("/", graphql_app)
app.add_route("/graphql", graphql_app)


if os.environ.get("APOLLO_OTEL_EXPORTER_TYPE"):
    from tracing import setup_tracing

    setup_tracing(schema, app)

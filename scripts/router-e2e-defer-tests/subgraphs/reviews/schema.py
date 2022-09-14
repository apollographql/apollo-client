import strawberry


@strawberry.type
class Review:
    id: int
    body: str
    product_id: strawberry.Private[str]


reviews = [
    Review(
        id=1, body=f"A review for Apollo Federation", product_id="apollo-federation"
    ),
    Review(id=2, body=f"A review for Apollo Studio", product_id="apollo-studio"),
]


def get_reviews(root: "Product") -> list[Review]:
    return list(filter(lambda r: r.product_id == root.id, reviews))


@strawberry.federation.interface()
class ProductItf:
    id: strawberry.ID
    reviews_count: int
    reviews_score: float
    reviews: list[Review]


@strawberry.federation.type(keys=["id"])
class Product(ProductItf):
    id: strawberry.ID
    reviews_count: int
    reviews_score: float = strawberry.federation.field(override="products")
    reviews: list[Review] = strawberry.field(resolver=get_reviews)

    @classmethod
    def resolve_reference(cls, id: strawberry.ID):
        return Product(id=id, reviews_count=3, reviews_score=4.6)


@strawberry.type
class Query:
    @strawberry.field
    def review(self, id: int) -> Review | None:
        return next((r for r in reviews if r.id == id), None)


schema = strawberry.federation.Schema(
    query=Query,
    types=[Product, Review],
    enable_federation_2=True,
    extensions=[],
)

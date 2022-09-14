package inventory.model

class Product(val id: String, val delivery: Delivery)
class Delivery(val estimatedDelivery: String, val fastestDelivery: String)
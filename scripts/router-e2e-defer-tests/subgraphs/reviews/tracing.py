import os

from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.exporter.zipkin.json import ZipkinExporter
from opentelemetry.instrumentation.starlette import StarletteInstrumentor
from opentelemetry.sdk.resources import SERVICE_NAME, Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor, BatchSpanProcessor
from strawberry.extensions.tracing import OpenTelemetryExtension


def setup_tracing(schema, app):
    resource = Resource(attributes={SERVICE_NAME: "reviews"})

    provider = TracerProvider(resource=resource)

    tracer_type = os.environ.get("APOLLO_OTEL_EXPORTER_TYPE")

    assert tracer_type in {"zipkin", "collector"}

    if tracer_type == "zipkin":
        host = os.environ.get("APOLLO_OTEL_EXPORTER_HOST", "localhost")
        port = os.environ.get("APOLLO_OTEL_EXPORTER_PORT", 9411)

        endpoint = f"http://{host}:{port}/api/v2/spans"

        zipkin_exporter = ZipkinExporter(endpoint=endpoint)

        span_processor = SimpleSpanProcessor(zipkin_exporter)
        provider.add_span_processor(span_processor)

        print("Tracing enabled with Zipkin exporter")

    if tracer_type == "collector":
        host = os.environ.get("APOLLO_OTEL_EXPORTER_HOST", "localhost")
        port = os.environ.get("APOLLO_OTEL_EXPORTER_PORT", 9411)

        endpoint = f"http://{host}:{port}/v1/traces"

        otlp_exporter = OTLPSpanExporter(endpoint=endpoint)

        span_processor = BatchSpanProcessor(otlp_exporter)

        provider.add_span_processor(span_processor)

        print("Tracing enabled with Collector exporter")

    trace.set_tracer_provider(provider)

    schema.extensions.append(OpenTelemetryExtension)
    StarletteInstrumentor().instrument_app(app)

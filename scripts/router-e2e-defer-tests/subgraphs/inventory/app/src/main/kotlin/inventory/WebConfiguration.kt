package inventory

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.graphql.server.webmvc.GraphQlHttpHandler
import org.springframework.web.servlet.function.router

@Configuration
class WebConfiguration {

    @Bean
    fun rootGraphQLRoute(httpHandler: GraphQlHttpHandler) = router {
        POST("/") { request ->
            httpHandler.handleRequest(request)
        }
    }
}
import { createServer, type Server } from 'node:http'
import cors from 'cors'
import { json } from 'body-parser'
import express from 'express'
import {
  type GraphQLFormattedError,
} from 'graphql'
import {
  type ApolloServerOptions,
  ApolloServer,
} from '@apollo/server'
import { expressMiddleware } from '@apollo/server/express4'
import { ApolloServerPluginLandingPageDisabled } from '@apollo/server/plugin/disabled'
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default'
// @ts-expect-error
import graphqlUploadExpress from 'graphql-upload/graphqlUploadExpress.js'
import {
  type KeystoneContext,
  type __ResolvedKeystoneConfig,
} from '../types'

/*
NOTE: This creates the main Keystone express server, including the
GraphQL API, but does NOT add the Admin UI middleware.

The Admin UI takes a while to build for dev, and is created separately
so the CLI can bring up the dev server early to handle GraphQL requests.
*/

function formatError (graphqlConfig: __ResolvedKeystoneConfig['graphql']) {
  return (formattedError: GraphQLFormattedError, error: unknown) => {
    let debug = graphqlConfig.debug
    if (debug === undefined) {
      debug = process.env.NODE_ENV !== 'production'
    }

    if (!debug && formattedError.extensions) {
      // Strip out any `debug` extensions
      delete formattedError.extensions.debug
      delete formattedError.extensions.exception
    }

    if (graphqlConfig.apolloConfig?.formatError) {
      return graphqlConfig.apolloConfig.formatError(formattedError, error)
    }

    return formattedError
  }
}

export async function createExpressServer (
  config: Pick<__ResolvedKeystoneConfig, 'graphql' | 'server' | 'storage'>,
  context: KeystoneContext
): Promise<{
  expressServer: express.Express
  apolloServer: ApolloServer<KeystoneContext>
  httpServer: Server
}> {
  const expressApp = express()
  const httpServer = createServer(expressApp)

  if (config.server.cors !== null) {
    expressApp.use(cors(config.server.cors))
  }

  expressApp.disable('etag')
  expressApp.disable('x-powered-by')
  expressApp.enable('case sensitive routing')
  expressApp.enable('strict routing')

  await config.server.extendExpressApp(expressApp, context)
  await config.server.extendHttpServer(httpServer, context)

  if (config.storage) {
    for (const val of Object.values(config.storage)) {
      if (val.kind !== 'local' || !val.serverRoute) continue
      expressApp.use(
        val.serverRoute.path,
        express.static(val.storagePath, {
          setHeaders (res) {
            if (val.type === 'file') {
              res.setHeader('Content-Type', 'application/octet-stream')
            }
          },
          index: false,
          redirect: false,
          lastModified: false,
        })
      )
    }
  }

  const apolloConfig = config.graphql.apolloConfig
  const serverConfig = {
    formatError: formatError(config.graphql),
    includeStacktraceInErrorResponses: config.graphql.debug,
    ...apolloConfig,

    schema: context.graphql.schema,
    plugins:
      config.graphql.playground === 'apollo'
        ? apolloConfig?.plugins
        : [
           config.graphql.playground
             ? ApolloServerPluginLandingPageLocalDefault()
             : ApolloServerPluginLandingPageDisabled(),
            ...(apolloConfig?.plugins ?? []),
          ],
  } as ApolloServerOptions<KeystoneContext> // TODO: satisfies

  const apolloServer = new ApolloServer({ ...serverConfig })
  const maxFileSize = config.server.maxFileSize

  expressApp.use(graphqlUploadExpress({ maxFileSize }))
  await apolloServer.start()
  expressApp.use(
    config.graphql.path,
    json(config.graphql.bodyParser),
    expressMiddleware(apolloServer, {
      context: async ({ req, res }) => {
        return await context.withRequest(req, res)
      },
    })
  )

  return { expressApp, apolloServer, httpServer }
}

import type { NextApiRequest, NextApiResponse } from "next"
import clientFactory from "lib/graphql-client-factory"
import { siteResolver } from "lib/site-resolver"
import { GraphQLRedirectsService } from "@sitecore-jss/sitecore-jss/site"
import getConfig from "next/config"
import { hashPath, updateEdgeConfig } from "./utils"
import { createClient } from "@vercel/edge-config"

export async function handler(_request: NextApiRequest, response: NextApiResponse) {
  // 1. Environment validation
  if (
    !process.env.SITECORE_SITE_NAME ||
    !process.env.EDGE_CONFIG_ENDPOINT ||
    !process.env.EDGE_CONFIG_VERCEL_TOKEN
  ) {
    return response.status(500).json({
      error: "Environment variables for Vercel Edge Config are not set",
    })
  }

  // 2. Authentication - Skipped for demo purposes
  // if (request.headers["sc-redirect-publish-webhook-key"] !== process.env.SITECORE_WEBHOOK_KEY) {
  //   return response.status(401).json({ error: "Unauthorized" })
  // }

  try {
    // 3. Service configuration
    const config = {
      clientFactory,
      locales: getConfig().publicRuntimeConfig.i18n,
      excludeRoute: () => false,
      siteResolver,
    }

    // 4. Fetch redirects from Sitecore
    const redirectsService = new GraphQLRedirectsService({ ...config, fetch: fetch })
    const redirects = await redirectsService.fetchRedirects(process.env.SITECORE_SITE_NAME)

    // 5. Get all existing Edge Config redirects
    const edgeConfigClient = createClient(process.env.EDGE_CONFIG)
    const edgeConfig = await edgeConfigClient.getAll()
    const existingKeys = Object.keys(edgeConfig || {})

    // 6. Create new Edge Config redirect items
    const edgeConfigRedirectItems = await Promise.all(
      redirects.map(async (redirect) => {
        // Remove query string and trailing slash to match middleware path
        // Note with this solution regex redirects should be moved to next.config.js
        const cleanPattern = redirect.pattern.split("?")[0].replace(/\/+$/, "")
        // Edge config requires alphanumeric keys so hashing is required
        const redirectKey = await hashPath(cleanPattern)
        return {
          operation: "upsert",
          key: `${process.env.SITECORE_SITE_NAME}_${redirectKey}`,
          value: JSON.stringify(redirect),
        }
      }),
    )

    // 7. Filter out items that already exist in edge config
    const newItems = edgeConfigRedirectItems.filter((item) => !existingKeys.some((key) => key === item.key))

    // 8. Filter out items that no longer exist in Sitecore
    const removedItems = existingKeys
      .filter((key) => !edgeConfigRedirectItems.some((redirect) => redirect.key === key))
      .map((key) => ({
        operation: "delete",
        key: key,
      }))

    const result = await updateEdgeConfig([...newItems, ...removedItems], {
      endpoint: process.env.EDGE_CONFIG_ENDPOINT,
      token: process.env.EDGE_CONFIG_VERCEL_TOKEN,
      siteName: process.env.SITECORE_SITE_NAME,
    })

    return response.status(200).send(result)
  } catch (error) {
    console.error(error)
    response.status(500).json({ error: "Error updating Edge Config" })
  }
}


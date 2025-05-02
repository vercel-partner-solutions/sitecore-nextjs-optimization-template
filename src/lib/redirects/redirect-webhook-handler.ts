import type { NextApiRequest, NextApiResponse } from "next"
import clientFactory from "lib/graphql-client-factory"
import { siteResolver } from "lib/site-resolver"
import { GraphQLRedirectsService } from "@sitecore-jss/sitecore-jss/site"
import nextConfig from "next.config"
import { updateEdgeConfig } from "./utils"
import { createBloomFilter } from "./simple-bloom-filter"

export async function handler(_request: NextApiRequest, response: NextApiResponse) {
  // 1. Environment validation
  if (
    !process.env.SITECORE_SITE_NAME ||
    !process.env.EDGE_CONFIG_ENDPOINT ||
    !process.env.EDGE_CONFIG_VERCEL_TOKEN
  ) {
    return response.status(500).json({
      error: 'Environment variables for Vercel Edge Config are not set',
    });
  }

  // 2. Authentication - Commented out for demo purposes
  // if (request.headers['sc-redirect-publish-webhook-key'] !== process.env.SITECORE_WEBHOOK_KEY) {
  //  return response.status(401).json({ error: 'Unauthorized' });
  // }

  try {
    // 3. Service configuration
    const config = {
      clientFactory,
      locales: nextConfig().i18n,
      excludeRoute: () => false,
      siteResolver,
    };

    // 4. Fetch redirects from Sitecore
    const redirectsService = new GraphQLRedirectsService({ ...config, fetch: fetch });
    const redirects = await redirectsService.fetchRedirects(process.env.SITECORE_SITE_NAME);

    // 5. Create bloom filter using the pathname as the key
    const bloomFilter = createBloomFilter(
      redirects.map((r) => r.pattern.split('?')[0].replace(/\/+$/, ''))
    );

    // 6. Update Edge Config with the bloom filter
    const result = await updateEdgeConfig(
      [
        {
          operation: 'upsert',
          key: `${process.env.SITECORE_SITE_NAME}`,
          value: JSON.stringify(bloomFilter),
        },
      ],
      {
        endpoint: process.env.EDGE_CONFIG_ENDPOINT,
        token: process.env.EDGE_CONFIG_VERCEL_TOKEN,
        siteName: process.env.SITECORE_SITE_NAME,
      }
    );

    if (!result.success) {
      return response.status(500).json({ error: 'Error updating Edge Config' });
    }
    return response.status(200).send(result);
  } catch (error) {
    console.error(error);
    response.status(500).json({ error: 'Error updating Edge Config' });
  }
}

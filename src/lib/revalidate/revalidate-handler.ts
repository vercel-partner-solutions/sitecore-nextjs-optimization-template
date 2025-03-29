import { GraphQLLayoutService } from '@sitecore-jss/sitecore-jss-nextjs';
import { createGraphQLClientFactory } from 'lib/graphql-client-factory/create';
import { NextApiRequest, NextApiResponse } from 'next';

type UpdatedItem = {
  item: {
    id: string;
    template: {
      id: string;
      name: string;
    };
    url: {
      path: string;
    };
  };
};

class GraphQLRevalidationService extends GraphQLLayoutService {
  async getItems(id: string) {
    const query = `
    query { 
      item(path: "${id}", language: "en") {
        id
        template {
          id
          name
        }
        url {
        path
      }
    }
  }`;
    return await this.getGraphQLClient().request(query);
  }
}

export const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" })
  }
  
  try {
    const data = req.body;

    // Initialize GraphQL service for fetching item data
    const service = new GraphQLRevalidationService({
      siteName: process.env.SITECORE_SITE_NAME || '',
      clientFactory: createGraphQLClientFactory({
        sitecoreEdgeContextId: process.env.SITECORE_EDGE_CONTEXT_ID!,
      }),
    });

    // Filter for Item updates and fetch their details
    const getItemPromises = data.updates
      .filter((update: { entity_definition: string }) => update.entity_definition === 'Item')
      .map((update: { identifier: string }) => service.getItems(update.identifier));

    const updatedItems = await Promise.all(getItemPromises);

    // Filter for only Page template items
    const updatedPages = updatedItems.filter(
      (updatedItem: UpdatedItem) => updatedItem.item.template.name === 'Page'
    );

    // Revalidate each updated page
    const revalidatePromises = updatedPages.map((page) => {
      return res.revalidate(page.item.url.path);
    });

    await Promise.all(revalidatePromises);

    return res.status(200).json({
      success: true,
    });
  } catch (error) {
    console.error('Revalidation error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
};

export default handler;


import { GraphQLLayoutService } from '@sitecore-jss/sitecore-jss-nextjs';
import { createGraphQLClientFactory } from 'lib/graphql-client-factory/create';
import { NextApiRequest, NextApiResponse } from 'next';

class GraphQLPagesService extends GraphQLLayoutService {
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { id } = req.body;

  if (!id) {
    return res.status(400).json({ message: 'ID is required' });
  }

  try {
    const service = new GraphQLPagesService({
      siteName: process.env.SITECORE_SITE_NAME || '',
      clientFactory: createGraphQLClientFactory({
        sitecoreEdgeContextId: process.env.SITECORE_EDGE_CONTEXT_ID!,
      }),
    });

    const data = await service.getItems(id);
    res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching pages:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

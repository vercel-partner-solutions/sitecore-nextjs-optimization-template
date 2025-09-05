import { GraphQLLayoutService } from '@sitecore-jss/sitecore-jss-nextjs';
import { createGraphQLClientFactory } from 'lib/graphql-client-factory/create';
import { NextApiRequest, NextApiResponse } from 'next';

interface WebhookUpdate {
  entity_definition?: string;
  identifier?: string;
}

interface WebhookPayload {
  updates?: WebhookUpdate[];
}

interface GraphQLItemResponse {
  item?: {
    id?: string;
    template?: {
      id?: string;
      name?: string;
    };
    url?: {
      path?: string;
    };
  } | null;
}

interface UpdatedItem {
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
}

class GraphQLRevalidationService extends GraphQLLayoutService {
  async getItems(id: string): Promise<GraphQLItemResponse> {
    if (!id?.trim()) {
      throw new Error('Item identifier is required');
    }
    
    const sanitizedId = id.replace(/['"\\]/g, '');
    
    const query = `
    query { 
      item(path: "${sanitizedId}", language: "en") {
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
    
    try {
      return await this.getGraphQLClient().request<GraphQLItemResponse>(query);
    } catch (error) {
      console.error(`Failed to fetch item with id ${id}:`, error);
      throw error;
    }
  }
}

export const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  // Environment validation
  if (!process.env.SITECORE_SITE_NAME || !process.env.SITECORE_EDGE_CONTEXT_ID) {
    console.error('Missing required environment variables: SITECORE_SITE_NAME, SITECORE_EDGE_CONTEXT_ID');
    return res.status(500).json({
      success: false,
      error: 'Server configuration error',
    });
  }
  
  try {
    const data = req.body as WebhookPayload;

    // Validate request payload
    if (!data || !Array.isArray(data.updates)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid webhook payload: updates array is required',
      });
    }

    if (data.updates.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No updates to process',
      });
    }

    // Initialize GraphQL service for fetching item data
    const service = new GraphQLRevalidationService({
      siteName: process.env.SITECORE_SITE_NAME,
      clientFactory: createGraphQLClientFactory({
        sitecoreEdgeContextId: process.env.SITECORE_EDGE_CONTEXT_ID,
      }),
    });

    // Filter for Item updates and validate identifiers
    const validUpdates = data.updates
      .filter((update): update is Required<WebhookUpdate> => 
        update?.entity_definition === 'Item' && 
        typeof update.identifier === 'string' && 
        update.identifier.trim().length > 0
      );

    if (validUpdates.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No valid item updates to process',
      });
    }

    // Fetch item details with individual error handling
    const itemPromises = validUpdates.map(async (update) => {
      try {
        const result = await service.getItems(update.identifier);
        return result;
      } catch (error) {
        console.error(`Failed to fetch item ${update.identifier}:`, error);
        return null;
      }
    });

    const updatedItems = await Promise.all(itemPromises);

    // Filter for valid responses and Page template items
    const validPages: UpdatedItem[] = updatedItems
      .filter((item): item is NonNullable<GraphQLItemResponse> => 
        item?.item != null
      )
      .filter((item): item is UpdatedItem => {
        const { item: itemData } = item;
        return (
          itemData?.id != null &&
          itemData?.template?.name === 'Page' &&
          itemData?.url?.path != null &&
          typeof itemData.url.path === 'string' &&
          itemData.url.path.trim().length > 0
        );
      });

    if (validPages.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No valid pages found to revalidate',
      });
    }

    // Revalidate each page with individual error handling
    const revalidateResults = await Promise.allSettled(
      validPages.map(async (page) => {
        try {
          await res.revalidate(page.item.url.path);
          return { success: true, path: page.item.url.path };
        } catch (error) {
          console.error(`Failed to revalidate path ${page.item.url.path}:`, error);
          return { 
            success: false, 
            path: page.item.url.path, 
            error: error instanceof Error ? error.message : 'Unknown revalidation error' 
          };
        }
      })
    );

    const successful = revalidateResults.filter((result) => 
      result.status === 'fulfilled' && result.value.success
    ).length;

    const failed = revalidateResults.length - successful;

    return res.status(200).json({
      success: true,
      message: `Revalidation completed: ${successful} successful, ${failed} failed`,
      details: {
        total: revalidateResults.length,
        successful,
        failed,
      },
    });
  } catch (error) {
    console.error('Revalidation error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred.',
    });
  }
};

export default handler;


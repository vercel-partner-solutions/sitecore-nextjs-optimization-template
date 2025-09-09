import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { path } = req.body;

    if (!path || typeof path !== 'string') {
      return res.status(400).json({ error: 'Path is required and must be a string' });
    }

    // Ensure path starts with /
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;

    await res.revalidate(normalizedPath);

    return res.status(200).json({
      success: true,
      message: `Successfully revalidated: ${normalizedPath}`,
      path: normalizedPath,
    });
  } catch (error) {
    console.error('Revalidation error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to revalidate',
    });
  }
}

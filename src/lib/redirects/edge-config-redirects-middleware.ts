import { NextResponse, type NextRequest } from "next/server"
import type { RedirectInfo } from "@sitecore-jss/sitecore-jss/site"
import { RedirectsMiddleware, type RedirectsMiddlewareConfig } from "@sitecore-jss/sitecore-jss-nextjs/middleware"
import { get } from "@vercel/edge-config"
import { SimpleBloomFilter } from "./simple-bloom-filter"

/**
 * Middleware that extends the standard JSS RedirectsMiddleware to use a Bloom filter
 * for efficient redirect lookups with Vercel Edge Config
 *
 * The Bloom filter allows us to quickly determine if a path might have a redirect
 * without having to check every path against the full redirects list.
 */
export class EdgeConfigRedirectsMiddleware extends RedirectsMiddleware {
  /**
   * Creates a new instance of the BloomFilterRedirectsMiddleware
   *
   * @param config - Configuration for the redirects middleware
   */
  constructor(protected config: RedirectsMiddlewareConfig) {
    super(config)
  }

  /**
   * Returns the middleware handler function
   *
   * @returns A function that processes the request and returns a response
   */
  public getHandler(): (req: NextRequest, res?: NextResponse) => Promise<NextResponse> {
    return async (req, res) => {
      try {
        return await this.redirectsHandler(req, res)
      } catch (error) {
        console.log(error)
        return res || NextResponse.next()
      }
    }
  }

  /**
   * Handles redirect requests
   *
   * @param req - The Next.js request
   * @param res - The Next.js response (optional)
   * @returns The Next.js response, either redirected or passed through
   * @private
   */
  private redirectsHandler = async (req: NextRequest, res?: NextResponse): Promise<NextResponse> => {
    return this.processRedirectRequest(req, res)
  }

  /**
   * Checks if a redirect exists for the current request
   *
   * This method overrides the base implementation to first check the Bloom filter
   * before performing the more expensive redirect lookup.
   *
   * @param req - The Next.js request
   * @param siteName - The name of the site
   * @returns Redirect information if a redirect exists, undefined otherwise
   * @protected
   */
  protected async getExistsRedirect(
    req: NextRequest,
    siteName: string,
  ): Promise<(RedirectInfo & { matchedQueryString?: string }) | undefined> {
    const { pathname } = req.nextUrl.clone()

    // Get the Bloom filter from Edge Config
    const bloomFilterJSON = await get<string>(siteName)

    if (!bloomFilterJSON) return

    // Reconstruct the Bloom filter from JSON
    const bloomFilter = SimpleBloomFilter.fromJSON(bloomFilterJSON)

    // Check if the path might have a redirect
    if (bloomFilter.has(pathname)) {
      console.debug("Bloom Filter contains redirect, forwarding request.")
      // If the Bloom filter indicates a possible match, check the actual redirects
      return super.getExistsRedirect(req, siteName)
    }

    console.debug("Bloom Filter does not contain redirect, skipping.")
    // If the Bloom filter indicates no match, we can skip the redirect lookup
    return
  }
}


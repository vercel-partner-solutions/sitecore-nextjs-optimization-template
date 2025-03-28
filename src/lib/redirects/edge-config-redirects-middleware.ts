import { NextResponse, type NextRequest } from "next/server"
import type { RedirectInfo } from "@sitecore-jss/sitecore-jss/site"
import { RedirectsMiddleware, type RedirectsMiddlewareConfig } from "@sitecore-jss/sitecore-jss-nextjs/middleware"
import { get } from "@vercel/edge-config"
import { hashPath } from "./utils"

export class EdgeConfigRedirectsMiddleware extends RedirectsMiddleware {
  constructor(protected config: RedirectsMiddlewareConfig) {
    super(config)
  }

  public getHandler(): (req: NextRequest, res?: NextResponse) => Promise<NextResponse> {
    return async (req, res) => {
      try {
        return await this.redirectsHandler(req, res)
      } catch (error) {
        console.log("Redirect middleware failed:")
        console.log(error)
        return res || NextResponse.next()
      }
    }
  }

  private redirectsHandler = async (req: NextRequest, res?: NextResponse): Promise<NextResponse> => {
    return this.processRedirectRequest(req, res)
  }

  protected async getExistsRedirect(
    req: NextRequest,
    siteName: string,
  ): Promise<(RedirectInfo & { matchedQueryString?: string }) | undefined> {
    const { pathname } = req.nextUrl.clone()
    const redirectKey = await hashPath(pathname)
    const redirect = await get<string>(`${siteName}_${redirectKey}`)

    if (!redirect) return undefined

    const edgeConfigRedirect = JSON.parse(redirect) as RedirectInfo & {
      matchedQueryString?: string
    }

    // return the matched redirect but update the pattern to a regex since Sitecore expects that
    return {
      ...edgeConfigRedirect,
      matchedQueryString: "",
      pattern: `/^\/${edgeConfigRedirect.pattern
        .replace(/^\/|\/$/g, "") // Removes leading and trailing slashes
        .replace(/^\^\/|\/\$$/g, "") // Removes unnecessary start (^) and end ($) anchors
        .replace(/^\^|\$$/g, "") // Further cleans up anchors
        .replace(/\$\/gi$/g, "")}[\/]?$/i`, // Ensures the pattern allows an optional trailing slash
    }
  }
}


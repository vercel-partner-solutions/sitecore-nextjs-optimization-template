export async function hashPath(path: string) {
  const hashBuffer = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(path))
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
}

export async function updateEdgeConfig(
  items: { operation: string; key: string; value?: string }[],
  config: { endpoint: string | undefined; token: string | undefined; siteName: string | undefined },
) {
  if (!config.endpoint || !config.token || !config.siteName) {
    return { error: "Edge config endpoint or token or siteName is not set" }
  }

  try {
    const response = await fetch(config.endpoint, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: items,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      console.error("Failed to update Edge Config", error)
      return { error: `Failed to update Edge Config: ${response.statusText}` }
    }

    return { success: true, items }
  } catch (error) {
    console.error("Failed to update Edge Config", error)
    return { error: `Failed to update Edge Config: ${error}` }
  }
}


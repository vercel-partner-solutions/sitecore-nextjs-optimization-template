/**
 * A simple implementation of a Bloom filter
 *
 * A Bloom filter is a space-efficient probabilistic data structure that is used to test
 * whether an element is a member of a set. False positives are possible, but false negatives are not.
 */
export class SimpleBloomFilter {
  private bitArray: number[]
  private hashFunctions: number

  /**
   * Creates a new Bloom filter
   *
   * @param size - The size of the bit array
   * @param hashFunctions - The number of hash functions to use
   */
  constructor(size: number, hashFunctions: number) {
    this.bitArray = new Array(size).fill(0)
    this.hashFunctions = hashFunctions
  }

  /**
   * Adds an element to the Bloom filter
   *
   * @param element - The element to add
   */
  public add(element: string): void {
    const hashes = this.getHashes(element)

    for (const hash of hashes) {
      this.bitArray[hash] = 1
    }
  }

  /**
   * Checks if an element might be in the Bloom filter
   *
   * @param element - The element to check
   * @returns True if the element might be in the set, false if it definitely is not
   */
  public has(element: string): boolean {
    const hashes = this.getHashes(element)

    for (const hash of hashes) {
      if (this.bitArray[hash] === 0) {
        return false
      }
    }

    return true
  }

  /**
   * Converts the Bloom filter to a JSON representation
   *
   * @returns Object containing the bit array and number of hash functions
   */
  public toJSON(): { bitArray: number[]; hashFunctions: number } {
    return {
      bitArray: this.bitArray,
      hashFunctions: this.hashFunctions,
    }
  }

  /**
   * Creates a Bloom filter from a JSON representation
   *
   * @param json - JSON representation of a Bloom filter
   * @returns A new Bloom filter instance
   */
  public static fromJSON(json: string | { bitArray: number[]; hashFunctions: number }): SimpleBloomFilter {
    const { bitArray, hashFunctions } = typeof json === "string" ? JSON.parse(json) : json
    const filter = new SimpleBloomFilter(bitArray.length, hashFunctions)
    filter.bitArray = bitArray
    return filter
  }

  /**
   * Generates hash values for an element
   *
   * @param element - The element to hash
   * @returns Array of hash values
   * @private
   */
  private getHashes(element: string): number[] {
    const hashes: number[] = []

    // Generate k different hash values using a simple hash function
    // This is a simple implementation - production code would use better hash functions
    for (let i = 0; i < this.hashFunctions; i++) {
      let hash = 0
      for (let j = 0; j < element.length; j++) {
        // Use different seed for each hash function
        hash = ((hash << 5) - hash + element.charCodeAt(j) + i) | 0
      }

      // Ensure positive index within range
      hash = Math.abs(hash) % this.bitArray.length
      hashes.push(hash)
    }

    return hashes
  }
}

/**
 * Updates the Vercel Edge Config with the provided items
 *
 * @param items - Array of operations to perform on Edge Config (upsert, delete, etc.)
 * @param config - Configuration object containing endpoint, token, and siteName
 * @returns Object indicating success or error
 */
export async function updateEdgeConfig(
  items: { operation: string; key: string; value?: string }[],
  config: { endpoint: string | undefined; token: string | undefined; siteName: string | undefined },
) {
  if (!config.endpoint || !config.token || !config.siteName) {
    return { error: "Edge config endpoint or token or siteName is not set" }
  }

  try {
    // Send PATCH request to Edge Config API
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

/**
 * Creates a Bloom filter from an array of keys
 *
 * A Bloom filter is a space-efficient probabilistic data structure that is used to test
 * whether an element is a member of a set. False positives are possible, but false negatives are not.
 *
 * @param keys - Array of strings to add to the Bloom filter
 * @param errorRate - Desired false positive rate (default: 0.0001 or 0.01%)
 * @returns JSON representation of the Bloom filter (bit array and number of hash functions)
 */
export const createBloomFilter = (
  keys: string[],
  errorRate = 0.0001,
): { bitArray: number[]; hashFunctions: number } => {
  // Calculate optimal size and number of hash functions
  // Formula: m = -n*ln(p)/(ln(2)^2) where m is size, n is number of items, p is error rate
  const size = Math.ceil(-(keys.length * Math.log(errorRate)) / Math.log(2) ** 2)

  // Formula: k = (m/n)*ln(2) where k is number of hash functions
  const hashFunctions = Math.ceil((size / keys.length) * Math.log(2))

  // Create the Bloom filter
  const bloomFilter = new SimpleBloomFilter(size, hashFunctions)

  // Add all keys to the Bloom filter
  for (const key of keys) {
    bloomFilter.add(key)
  }

  // Return the Bloom filter in a format suitable for Edge Config
  return bloomFilter.toJSON()
}

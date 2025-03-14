const createChunks = (arr, size) =>
  Array.from({ length: Math.ceil(arr.length / size) }, (v, i) => arr.slice(i * size, i * size + size));

export async function batch(task, items, batchSize, onBatchComplete) {
  const chunks = createChunks(items, batchSize);
  for (let i = 0; i < chunks.length; i++) {
    try {
      // Process items sequentially instead of in parallel to stop immediately on quota exceeded
      for (const item of chunks[i]) {
        try {
          await task(item);
        } catch (error) {
          if (error.message.includes('QUOTA_EXCEEDED')) {
            throw error; // Stop immediately on quota exceeded
          }
          throw error; // Re-throw other errors
        }
      }
      onBatchComplete(i, chunks.length);
    } catch (error) {
      if (error.message.includes('QUOTA_EXCEEDED')) {
        throw error; // Stop processing completely
      }
      throw error;
    }
  }
}

export async function fetchRetry(url, options, retries = 5) {
  try {
    const response = await fetch(url, options);
    
    // Check for quota exceeded (429) error first
    if (response.status === 429) {
      const body = await response.text();
      throw new Error(`QUOTA_EXCEEDED: API quota exceeded (429)\n${body}`);
    }
    
    if (response.status >= 500) {
      const body = await response.text();
      throw new Error(`Server error code ${response.status}\n${body}`);
    }
    return response;
  } catch (err) {
    // Don't retry quota exceeded errors
    if (err.message.includes('QUOTA_EXCEEDED')) {
      throw err;
    }
    
    if (retries <= 0) {
      throw err;
    }
    return fetchRetry(url, options, retries - 1);
  }
}

const createChunks = (arr, size) =>
  Array.from({ length: Math.ceil(arr.length / size) }, (v, i) => arr.slice(i * size, i * size + size));

export async function batch(task, items, batchSize, onBatchComplete) {
  const chunks = createChunks(items, batchSize);
  for (let i = 0; i < chunks.length; i++) {
    try {
      await Promise.all(chunks[i].map(async (item) => {
        try {
          return await task(item);
        } catch (error) {
          // If this is our special signal error, propagate it up
          if (error.message.includes('STOP_PROCESSING_BUT_SAVE_RESULTS')) {
            throw error;
          }
          // Otherwise handle the error for this item only
          throw error;
        }
      }));
      onBatchComplete(i, chunks.length);
    } catch (error) {
      // If this is our special signal error, stop processing and propagate it up
      if (error.message.includes('STOP_PROCESSING_BUT_SAVE_RESULTS')) {
        throw error;
      }
      // For other errors, continue with the next batch
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

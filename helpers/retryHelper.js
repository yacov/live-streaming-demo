class RetryHelper {
  async fetchWithRetries(url, options, retries = 1, maxRetryCount = 3, maxDelaySec = 4) {
    try {
      return await fetch(url, options);
    } catch (err) {
      if (retries <= maxRetryCount) {
        const delay = Math.min(Math.pow(2, retries) / 4 + Math.random(), maxDelaySec) * 1000;

        await new Promise((resolve) => setTimeout(resolve, delay));

        console.log(`Request failed, retrying ${retries}/${maxRetryCount}. Error ${err}`);
        return this.fetchWithRetries(url, options, retries + 1);
      } else {
        throw new Error(`Max retries exceeded. error: ${err}`);
      }
    }
  }
}

export default RetryHelper;
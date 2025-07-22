export const randomDelay = async (seconds = 1) => {
  const minDelay = 0;
  const maxDelay = seconds * 1000; //convert to milliseconds
  const randomMs = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
  //console.log(`Waiting for ${randomMs}ms before next request`);
  return new Promise((resolve) => setTimeout(() => resolve(randomMs), randomMs));
};

export const formatTimestamp = (timestampSeconds: number) => {
  const wholeSeconds = Math.floor(timestampSeconds);
  const minutes = Math.floor(wholeSeconds / 60);
  const seconds = String(wholeSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
};

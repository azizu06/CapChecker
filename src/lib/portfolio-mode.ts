type RuntimeEnvironment = {
  NODE_ENV?: string;
  GEMINI_API_KEY?: string;
  FINNHUB_KEY?: string;
};

export const isPortfolioDemoMode = (
  environment: RuntimeEnvironment = process.env,
): boolean =>
  environment.NODE_ENV === "production" &&
  (!environment.GEMINI_API_KEY || !environment.FINNHUB_KEY);

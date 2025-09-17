/**
 * Converts nanoseconds to a human-readable string
 */
export function formatDuration(nanoseconds: number): string {
  const seconds = nanoseconds / 1_000_000_000;

  if (seconds < 1) {
    return `${Math.round(seconds * 1000)}ms`;
  } else if (seconds < 60) {
    return `${seconds.toFixed(2)}s`;
  } else {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = (seconds % 60).toFixed(0);
    return `${minutes}m ${remainingSeconds}s`;
  }
}

/**
 * Formats ollama response durations for logging
 */
export function formatOllamaMetrics(response: {
  total_duration: number;
  load_duration: number;
  prompt_eval_count: number;
}): string {
  return (
    `Duration: ${formatDuration(response.total_duration)}, ` +
    `Model loaded in: ${formatDuration(response.load_duration)}, ` +
    `Tokens utilized: ${response.prompt_eval_count}`
  );
}

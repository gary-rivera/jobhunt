import { ValidationError } from '../lib/errors/index';

export function parseISODateString(dateString: string): Date {
  if (!dateString) throw new ValidationError('Date string is empty or undefined');
  const date = new Date(dateString);
  if (isNaN(date.getTime())) throw new ValidationError('Invalid date format');

  return date;
}

export function parseRelativeTime(timeStr: string): Date {
  if (!timeStr) throw new ValidationError('Relative time string is empty or undefined');
  const now = new Date();
  const regex = /(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago/i;
  const match = timeStr.match(regex);

  if (!match) {
    throw new ValidationError(`Unable to parse time: ${timeStr}`);
  }

  const [, amount, unit] = match;
  const value = parseInt(amount, 10);

  switch (unit.toLowerCase()) {
    case 'second':
      return new Date(now.getTime() - value * 1000);
    case 'minute':
      return new Date(now.getTime() - value * 60 * 1000);
    case 'hour':
      return new Date(now.getTime() - value * 60 * 60 * 1000);
    case 'day':
      return new Date(now.getTime() - value * 24 * 60 * 60 * 1000);
    case 'week':
      return new Date(now.getTime() - value * 7 * 24 * 60 * 60 * 1000);
    case 'month': {
      const monthsAgo = new Date(now);
      monthsAgo.setMonth(monthsAgo.getMonth() - value);
      return monthsAgo;
    }
    case 'year': {
      const yearsAgo = new Date(now);
      yearsAgo.setFullYear(yearsAgo.getFullYear() - value);
      return yearsAgo;
    }
    default:
      throw new ValidationError(`Unsupported time unit: ${unit}`);
  }
}

/**
 * Converts nanoseconds to a human-readable string
 */
export function convertNanosecondsToHumanReadable(nanoseconds: number): string {
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
    `Duration: ${convertNanosecondsToHumanReadable(response.total_duration)}, ` +
    `Model loaded in: ${convertNanosecondsToHumanReadable(response.load_duration)}, ` +
    `Tokens utilized: ${response.prompt_eval_count}`
  );
}

export function generateTimestampTodayStart(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return today;
}

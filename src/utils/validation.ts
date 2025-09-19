export function validateRequiredFields(fields: Record<string, unknown>): {
  requirementsMet: boolean;
  missing: string[];
} {
  const missing = Object.entries(fields)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  return {
    requirementsMet: !missing.length,
    missing,
  };
}

import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';

export function validateRequiredFields(
  curr: Record<string, unknown>,
  model: Prisma.ModelName,
  options?: {
    allowEmpty?: boolean;
    treatEmptyStringsAsMissing?: boolean;
  },
): {
  valid: boolean;
  missing: string[];
} {
  const requiredFields: string[] = prisma.getRequiredFields(model);

  return validateKeysArePresent(curr, requiredFields, options);
}

export function validateKeysArePresent(
  curr: Record<string, unknown>,
  requiredKeys: string[],
  options: {
    allowEmpty?: boolean;
    treatEmptyStringsAsMissing?: boolean;
  } = {},
) {
  const { allowEmpty = false, treatEmptyStringsAsMissing = true } = options;

  const missing: string[] = requiredKeys.filter((key) => {
    if (!Object.prototype.hasOwnProperty.call(curr, key)) return true;

    if (allowEmpty) {
      const value = curr[key];
      if (value === null || value === undefined) return true;
      if (treatEmptyStringsAsMissing && value === '') return true;
    }

    return false;
  });

  return {
    valid: missing.length === 0,
    missing,
  };
}

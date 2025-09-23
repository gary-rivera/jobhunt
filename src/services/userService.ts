import { User } from '@prisma/client';
import prisma from '../lib/prisma';
import { ValidationError } from '../lib/errors/internal';

// add try catch, akin to ollama service
export const getUserByAlias = async (alias: string): Promise<User> => {
  if (!alias) {
    throw new ValidationError('Alias field is required.');
  }

  log.info('[UserService][getUserByAlias] Fetching user profile for alias:', alias);

  const user = await prisma.user.findUniqueOrThrow({ where: { alias } });

  log.success('[UserService][getUserByAlias] Fetched user profile successfully.');
  return user;
};

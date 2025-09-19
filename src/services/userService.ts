import { User } from '@prisma/client';
import prisma from '../lib/prisma';
import { NotFoundError, ValidationError } from '../lib/errors/internal';

export const getUserByAlias = async (alias: string): Promise<User> => {
  if (!alias) {
    throw new ValidationError('Alias field is required.');
  }

  log.info('[UserService][getUserByAlias] Fetching user profile for alias:', alias);

  const response = (await prisma.$queryRaw`
    SELECT
      id,
      alias,
      bio,
      array(SELECT unnest(bio_embedding::real[])) as bio_embedding
    FROM user_profiles
    WHERE alias = ${alias}
  `) as User[];

  const user: User | null = response[0] || null;

  if (!user) {
    throw new NotFoundError('User record not found with provided alias.');
  }

  log.success('[UserService][getUserByAlias] Fetched user profile successfully.');
  return user;
};

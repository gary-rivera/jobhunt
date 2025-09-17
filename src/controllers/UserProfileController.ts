import { Request, Response } from 'express';
import { UserProfile } from '@prisma/client';
import prisma from '../lib/prisma';
import { sendBadRequestError, sendNotFoundError, sendInternalServerError } from '../utils/error';

async function getUser(req: Request, res: Response): Promise<UserProfile | Response> {
  try {
    const { alias } = req.params;

    if (!alias) {
      return sendBadRequestError(res, '[UserProfileController] Alias field is required.');
    }

    log.info('[UserProfileController] Fetching user profile for alias:', alias);
    const response = (await prisma.$queryRaw`
        SELECT
          id,
          alias,
          bio,
          array(SELECT unnest(bio_embedding::real[])) as bio_embedding
        FROM user_profiles
        WHERE alias = ${alias}
      `) as UserProfile[];

    const user: UserProfile | null = response[0] || null;

    if (!user) {
      return sendNotFoundError(
        res,
        '[UserProfileController] UserProfile record not found under provided alias.',
      );
    }

    log.success('[UserProfileController] Fetched user profile successfully.');
    return user;
  } catch (err) {
    log.error('Error fetching user profile:', err);
    return sendInternalServerError(res);
  }
}

export { getUser };

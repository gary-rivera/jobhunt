import { Request, Response } from 'express';
import { UserProfile } from '@prisma/client';
import prisma from '../lib/prisma';
import { sendValidationError, sendNotFoundError, sendInternalServerError } from '../utils/error';

async function getUser(req: Request, res: Response): Promise<UserProfile | Response> {
  try {
    const { alias } = req.params;
    if (!alias) {
      return sendValidationError(res, 'Alias field is required');
    }
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
      return sendNotFoundError(res, 'UserProfile not found');
    }
    return user;
  } catch (err) {
    console.error('Error fetching user profile:', err);
    return sendInternalServerError(res);
  }
}

export { getUser };

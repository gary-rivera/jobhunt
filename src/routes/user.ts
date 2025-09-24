import Router from 'express';
import { createDefaultUser, getUserByAlias } from '../services/userService';
import { ConflictError } from '../lib/errors';

const userRouter = Router();

// NOTE: for now, only support fetching by alias since this is a personal project
// In future, may add auth and fetch by user id or token
userRouter.get('/:alias', async (req, res) => {
  const user = await getUserByAlias(req.params.alias);
  res.json(user);
});

userRouter.post('/embed', async (req, res) => {
  log.info('[user/embed] Attempting to create new user profile. Checking for duplicates...');
  const { alias } = req.body as {
    alias?: string;
  };
  const existing = await getUserByAlias(alias);
  if (existing) {
    throw new ConflictError('User with this alias already exists');
  }
  log.info('[user/embed] No existing user found. Proceeding to create new user profile...');
  const newUser = await createDefaultUser(alias);

  return res.status(201).json({
    success: true,
    user: newUser,
  });
});

// TODO: patch user profile, primarily to update bio and recalc bio_embedding

export { userRouter };

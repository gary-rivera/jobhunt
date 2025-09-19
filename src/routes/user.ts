import Router from 'express';
import prisma from '../lib/prisma';
import path from 'path';
import fs from 'fs/promises';
import { generateEmbedding } from '../services/ollama';
import { getUserByAlias } from '../services/userService';

const userRouter = Router();

// interface userJobPreferences {
//   seniority: 'internship' | 'junior' | 'mid' | 'senior' | 'lead';
// }

// NOTE: for now, only support fetching by alias since this is a personal project
// In future, may add auth and fetch by user id or token
userRouter.get('/:alias', async (req, res) => {
  const user = await getUserByAlias(req.params.alias);
  res.json(user);
});

// TODO: extract user creation and patch logic to controller
userRouter.post('/embed', async (req, res) => {
  log.info('[user/embed] Attempting to create new user profile. Checking for duplicates...');
  const { alias } = req.body as {
    alias?: string;
  };

  if (!alias) return res.status(400).json({ error: 'Alias field is required' });

  const existingUser = await prisma.user.findUnique({
    where: { alias },
  });

  if (existingUser) return res.status(409).json({ error: `User with this alias already exists: ${alias}` });

  log.info('[user/embed] Alias provided is valid and unique:', alias);

  // manually read from local file src/data/dingle.md for now
  let resume_md = '';
  const resumePath = path.join(__dirname, '../data/dingle.md');

  try {
    log.info('[user/embed] Reading resume from local file system:', resumePath);
    const data = await fs.readFile(resumePath, 'utf-8');

    log.success('[user/embed] Loaded from file system successfully.');
    resume_md = data;
  } catch (error) {
    log.error('[user/embed] Error reading resume file from local file system:', error);
    return res.status(500).json({ error: 'Failed to read resume file from local file system' });
  }

  const bioEmbedding = await generateEmbedding(resume_md);

  log.info('[user/embed] Generating user profile summary for:', alias);
  // const newUser = await prisma.$executeRaw`
  //   INSERT INTO user_profiles (alias, bio, bio_embedding)
  //   VALUES (${alias}, ${resume_md}, ${bioEmbedding})
  // `;

  const newUser = await prisma.user.create({
    data: {
      alias,
      bio: resume_md,
      bioEmbedding,
    },
  });
  log.success('[user/embed] Created new user profile successfully for:', alias);

  return res.status(201).json({
    message: 'User created successfully (sorta)',
    alias,
    user: newUser,
  });
});

// TODO: patch user profile, primarily to update bio and recalc bio_embedding

export { userRouter };

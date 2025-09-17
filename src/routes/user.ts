import Router from 'express';
import prisma from '../lib/prisma';
import path from 'path';
import fs from 'fs/promises';
import { generateEmbedding, generateUserProfileSummary } from '../services/ollama';

import { getUser } from '../controllers/UserProfileController';

const userRouter = Router();

interface userJobPreferences {
  seniority: 'internship' | 'junior' | 'mid' | 'senior' | 'lead';
}

// NOTE: for now, only support fetching by alias since this is a personal project
// In future, may add auth and fetch by user id or token
userRouter.get('/:alias', getUser);

// TODO: extract user creation and patch logic to controller
userRouter.post('/embed', async (req, res) => {
  const { alias } = req.body as {
    alias?: string;
  };

  if (!alias) return res.status(400).json({ error: 'Alias field is required' });

  // check if user with alias already exists
  const existingUser = await prisma.userProfile.findUnique({
    where: { alias },
  });

  if (existingUser) return res.status(409).json({ error: 'User with this alias already exists' });

  // check if resume_md is provided, if not, read from local file src/data/dingle.md

  // manually read from local file src/data/dingle.md
  let resume_md = '';
  const resumePath = path.join(__dirname, '../data/dingle.md');

  try {
    const data = await fs.readFile(resumePath, 'utf-8');
    console.log('Loaded resume from file system: \n', `${data.substring(0, 30)}...`);

    resume_md = data;
  } catch (error) {
    console.error('Error reading resume file:', error);
    return res.status(500).json({ error: 'Failed to read resume file from server' });
  }

  // generate profile embedding
  const embedResponse = await generateEmbedding(resume_md);
  const embedding = embedResponse?.embeddings[0];
  console.log('Generating user profile summary for:', alias);

  // create new user
  const newUser = await prisma.$executeRaw`
			INSERT INTO user_profiles (alias, bio, bio_embedding)
			VALUES (${alias}, ${resume_md}, ${embedding})
		`;

  return res.status(201).json({
    message: 'User created successfully (sorta)',
    alias,
    user: newUser,
  });
});

userRouter.patch('/:alias/summary', async (req, res) => {
  // TODO:
});

export { userRouter };

import { User } from '@prisma/client';
import prisma from '../lib/prisma';
import { InternalError, ValidationError } from '../lib/errors/internal';
import { generateEmbedding } from './ollama';
import path from 'path';
import fs from 'fs/promises';

export const getUserByAlias = async (alias: string = 'dingle'): Promise<User> => {
  if (!alias) {
    throw new ValidationError('Alias field is required.');
  }

  log.info('[UserService][getUserByAlias] Fetching user profile for alias:', alias);

  const user = await prisma.user.findUniqueOrThrow({ where: { alias } });

  log.success('[UserService][getUserByAlias] Fetched user profile successfully.');
  return user;
};

export const createDefaultUser = async (alias: string = 'dingle') => {
  let resume_md = '';
  const resumePath = path.join(__dirname, '../data/dingle.md');

  try {
    log.info('[createDefaultUser] Reading resume from local file system:', resumePath);
    const data = await fs.readFile(resumePath, 'utf-8');

    log.success('[createDefaultUser] Loaded from file system successfully.');
    resume_md = data;
  } catch (error) {
    log.error('[createDefaultUser] Error reading resume file from local file system:', error);
    throw new InternalError('Failed to read resume file from local file system', 'not_found', 404);
  }

  const bioEmbedding = await generateEmbedding(resume_md);

  log.info('[createDefaultUser] Generating user profile summary for:', alias);

  const newUser = await prisma.user.create({
    data: {
      alias,
      bio: resume_md,
      bioEmbedding,
    },
  });

  log.success('[createDefaultUser] Created new user profile successfully for:', alias);
  return newUser;
};

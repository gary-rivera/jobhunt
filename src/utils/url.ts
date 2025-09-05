import { Request, Response } from 'express';
import crypto from 'crypto';
import prisma from '../lib/prisma';
import validator from 'validator';

interface ValidationResult {
	isValid: boolean;
	isReachable: boolean;
	finalUrl: string;
	hasProtocol: boolean;
}

interface ReachabilityResult {
	isReachable: boolean;
	finalUrl?: string;
}

// source - https://stackoverflow.com/a/4643148
const PROTOCOL_REGEX_PATTERN = /^https?:\/\//i;

// NOTE: ideally would use a BASE_URL env variable here, but for assessment purposes using requrest based generation
export const buildShortenedUrl = (req: Request, slug: string): string => {
	return `${req.protocol}://${req.get('host')}/r/${slug}`;
};

export const isValidUrlFormat = (
	url: string,
	isRedirect: boolean = false
): boolean => {
	const isValid = validator.isURL(url, {
		protocols: ['http', 'https'],
		require_valid_protocol: isRedirect, // Strict for redirects, flexible for creation
		allow_underscores: true,
		allow_trailing_dot: false,
	});

	const context = isRedirect ? 'redirect' : 'creation';
	console.log(
		`[isValidUrl-${context}] URL format is ${isValid ? 'valid' : 'invalid'}`
	);
	return isValid;
};

// NOTE: if porotocol is not present, we generate both https and http versions for testing reachability
const generateUrlCandidates = (url: string, hasProtocol: boolean): string[] => {
	const trimmed = url.trim();

	if (hasProtocol) {
		return [trimmed];
	}
	return [`https://${trimmed}`, `http://${trimmed}`];
};
const checkUrlReachability = async (url: string): Promise<boolean> => {
	try {
		console.log('[checkUrlReachability] ensuring URL is parseable...');
		const parsedUrl = new URL(url);
		if (!parsedUrl.hostname.includes('.')) {
			return false;
		}
	} catch {
		return false;
	}

	try {
		console.log('[checkUrlReachability] checking url reachability...');
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 5000); // avoid hanging requests

		const response = await fetch(url, {
			method: 'HEAD',
			signal: controller.signal,
			// commented out due to potential bot blocking
			// headers: {
			// 	'User-Agent': 'URL-Shortener-Bot/1.0',
			// },
		});

		clearTimeout(timeoutId);

		return response.ok;
	} catch {
		return false;
	}
};

const findFirstReachableUrl = async (
	urls: string[]
): Promise<ReachabilityResult> => {
	if (urls.length === 0) {
		console.warn('[findFirstReachableUrl] No URLs provided');
		return { isReachable: false };
	}

	console.log('[findFirstReachableUrl] Checking reachability for URLs:', urls);
	for (const url of urls) {
		const isReachable = await checkUrlReachability(url);

		if (isReachable) {
			console.log(`[findFirstReachableUrl] URL ${url} is reachable`);
			return { isReachable: true, finalUrl: url };
		}
	}

	// if all urls fail, return not reachable
	console.warn('[findFirstReachableUrl] No reachable URLs found :(');
	return { isReachable: false };
};

export const validateUrl = async (
	urlString: string
): Promise<ValidationResult> => {
	console.log('[validateUrl] validating URL...');
	const urlTrimmed = urlString.trim();
	const hasProtocol = PROTOCOL_REGEX_PATTERN.test(urlTrimmed);
	const isValidFormat = isValidUrlFormat(urlTrimmed);

	const validationResult: ValidationResult = {
		isValid: false,
		isReachable: false,
		finalUrl: urlTrimmed,
		hasProtocol,
	};
	if (!isValidFormat) {
		return validationResult;
	}

	const candidateUrls = generateUrlCandidates(urlTrimmed, hasProtocol);
	const reachabilityResult: ReachabilityResult = await findFirstReachableUrl(
		candidateUrls
	);

	return {
		...validationResult,
		isValid: true,
		isReachable: reachabilityResult.isReachable,
		finalUrl: reachabilityResult.finalUrl || urlTrimmed,
	};
};

const generateSlug = (length: number): string => {
	const chars =
		'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
	let result = '';

	for (let i = 0; i < length; i++) {
		result += chars[Math.floor(Math.random() * chars.length)];
	}

	return result;
};

export const generateUniqueSlug = async (
	length = 6,
	maxLength = 12
): Promise<string> => {
	const maxAttempts = 10;

	for (let attempt = 0; attempt < maxAttempts; attempt++) {
		const slug = generateSlug(length);
		const exists = await prisma.shortenedUrl.findUnique({ where: { slug } });
		if (!exists) return slug;
	}

	if (length >= maxLength) {
		return crypto.randomBytes(6).toString('hex'); // fallback
	}

	return generateUniqueSlug(length + 1, maxLength);
};

import { z } from 'zod';

export const userRoles = ['user', 'moderator', 'administrator'] as const;

export const userRoleSchema = z.enum(userRoles);

export type UserRole = z.infer<typeof userRoleSchema>;

/** Whether others can see something of a user. Everything is public by default (BR-013). */
export const visibilitySchema = z.enum(['public', 'private']);

export type Visibility = z.infer<typeof visibilitySchema>;

export const minUsernameLength = 3;
export const maxUsernameLength = 30;
export const maxDisplayNameLength = 50;
export const maxBioLength = 300;

/**
 * Names that cannot be usernames (FR-PROF-001): a username is part of the profile URL, so it
 * must not look like a page of Flanr or like an official account. Compared without letter case.
 */
export const reservedUsernames: ReadonlySet<string> = new Set([
  'about',
  'account',
  'admin',
  'administrator',
  'api',
  'assets',
  'cities',
  'city',
  'explore',
  'feed',
  'flanr',
  'help',
  'imprint',
  'list',
  'lists',
  'login',
  'logout',
  'map',
  'me',
  'moderator',
  'new',
  'null',
  'official',
  'onboarding',
  'privacy',
  'profile',
  'register',
  'root',
  'search',
  'settings',
  'sign_in',
  'sign_up',
  'signin',
  'signup',
  'staff',
  'static',
  'statistics',
  'stats',
  'support',
  'system',
  'terms',
  'undefined',
  'user',
  'users',
  'www',
]);

export type UsernameProblem = 'length' | 'characters' | 'reserved';

export const usernameProblemMessages: Record<UsernameProblem, string> = {
  length: `A username has ${minUsernameLength} to ${maxUsernameLength} characters.`,
  characters: 'A username has only Latin letters, digits and underscores.',
  reserved: 'This username cannot be chosen.',
};

/**
 * Checks a username against FR-PROF-001. Returns null if it can be chosen; whether it is
 * taken is not checked here.
 */
export function checkUsername(username: string): UsernameProblem | null {
  if (username.length < minUsernameLength || username.length > maxUsernameLength) return 'length';
  if (!/^[A-Za-z0-9_]+$/.test(username)) return 'characters';
  if (reservedUsernames.has(username.toLowerCase())) return 'reserved';
  return null;
}

export const usernameSchema = z.string().superRefine((username, context) => {
  const problem = checkUsername(username);
  if (problem) context.addIssue({ code: 'custom', message: usernameProblemMessages[problem] });
});

const displayNameSchema = z.string().trim().min(1).max(maxDisplayNameLength);

/** Blank text is stored as no bio. */
const bioSchema = z
  .string()
  .trim()
  .max(maxBioLength)
  .nullable()
  .transform((bio) => bio || null);

/** The signed-in user with their profile and settings, as returned by GET /v1/me. */
export const currentUserSchema = z.object({
  id: z.number().int(),
  username: z.string(),
  displayName: z.string(),
  /** The picture of the account at the authentication provider (FR-PROF-002). */
  avatarUrl: z.string().nullable(),
  bio: z.string().nullable(),
  /** The current lived-in city (BR-016). Null if the user has none. */
  homeCityId: z.number().int().nullable(),
  /** Whether others see the home location. Hidden unless the user shows it (FR-PROF-003). */
  homeCityVisible: z.boolean(),
  profileVisibility: visibilitySchema,
  /** Visibility of the Visited list (FR-LIST-005). */
  visitedVisibility: visibilitySchema,
  /** Visibility of the Planned list (FR-LIST-005). */
  plannedVisibility: visibilitySchema,
  roles: z.array(userRoleSchema),
  /** When the account was created, as an ISO 8601 timestamp. Visits after it need a date (BR-002). */
  registeredAt: z.string(),
});

export type CurrentUser = z.infer<typeof currentUserSchema>;

/** Changes the profile and the settings of the signed-in user. Only the given fields change. */
export const updateProfileSchema = z.object({
  username: usernameSchema.optional(),
  displayName: displayNameSchema.optional(),
  bio: bioSchema.optional(),
  homeCityVisible: z.boolean().optional(),
  profileVisibility: visibilitySchema.optional(),
  visitedVisibility: visibilitySchema.optional(),
  plannedVisibility: visibilitySchema.optional(),
});

export type UpdateProfile = z.infer<typeof updateProfileSchema>;

/**
 * A profile as everyone sees it (FR-PROF-004). Of a private profile only the username and the
 * display name are shown (FR-PRIV-001); the other fields are null.
 */
export const publicProfileSchema = z.object({
  username: z.string(),
  displayName: z.string(),
  isPrivate: z.boolean(),
  avatarUrl: z.string().nullable(),
  bio: z.string().nullable(),
  /** Null also when the user hides the home location (FR-PROF-003). */
  homeCityId: z.number().int().nullable(),
});

export type PublicProfile = z.infer<typeof publicProfileSchema>;

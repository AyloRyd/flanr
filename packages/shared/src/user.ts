import { z } from 'zod';

export const userRoles = ['user', 'moderator', 'administrator'] as const;

export const userRoleSchema = z.enum(userRoles);

export type UserRole = z.infer<typeof userRoleSchema>;

/** The signed-in user, as returned by GET /v1/me. */
export const currentUserSchema = z.object({
  id: z.number().int(),
  username: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  roles: z.array(userRoleSchema),
  /** When the account was created, as an ISO 8601 timestamp. Visits after it need a date (BR-002). */
  registeredAt: z.string(),
});

export type CurrentUser = z.infer<typeof currentUserSchema>;

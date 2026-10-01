import { z } from 'zod'

// Fork: roles, users, activity log and link locks.

export const ROLES = ['admin', 'editor', 'viewer'] as const
export type Role = typeof ROLES[number]
export const ROLE_RANK: Record<Role, number> = { viewer: 1, editor: 2, admin: 3 }

export const UpdateUserSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  role: z.enum(ROLES).optional(),
  disabled: z.boolean().optional(),
})

export const ActivityListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  before: z.coerce.number().int().optional().describe('Return entries with id lower than this.'),
  actor: z.string().trim().max(254).optional(),
  action: z.string().trim().max(64).optional().describe('Exact action, or a prefix ending with * (e.g. link.*).'),
  targetType: z.string().trim().max(32).optional(),
  q: z.string().trim().max(128).optional().describe('Substring of the target label (slug, range, email).'),
})

export const LinkHistoryQuerySchema = z.object({
  slug: z.string().trim().min(1).max(2048).optional(),
  id: z.string().trim().min(1).max(26).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
}).refine(value => value.slug || value.id, 'slug or id is required')

export const DeletedLinksQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(100),
})

export const LinkActorsQuerySchema = z.object({
  ids: z.string().trim().min(1).max(8000).describe('Comma-separated link ids.'),
})

export const RestoreLinkSchema = z.object({
  activityId: z.number().int().positive().describe('Id of the link.delete activity entry to restore from.'),
})

export const RevertLinkSchema = z.object({
  activityId: z.number().int().positive().describe('Activity entry whose "after" version the link should return to.'),
})

export const LockLinkSchema = z.object({
  slug: z.string().trim().min(1).max(2048),
  expiresAt: z.number().int().positive().optional().describe('Unix seconds. Omit for a lock that lasts until it is removed.'),
  reason: z.string().trim().max(256).optional(),
})

export const UnlockLinkSchema = z.object({
  slug: z.string().trim().min(1).max(2048),
})

export const LinkLocksQuerySchema = z.object({
  ids: z.string().trim().max(8000).optional().describe('Comma-separated link ids. Omit to list all active locks.'),
})

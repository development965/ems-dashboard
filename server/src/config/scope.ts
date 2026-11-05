/**
 * The system's operating scope starts January 1, 2026 — everything before that is stray
 * legacy-migration data, not real activity under this system, and is treated as if it doesn't
 * exist: hidden from every list, report, and detail view, not just excluded by default filters.
 *
 * The single source of truth is a Student's own `createdAt` (enrollment date). Everything
 * that hangs off a student — their payments, discounts, outstanding balance, lead record if
 * any — goes out of scope with them, regardless of that sub-record's own date. A payment
 * made in 2026 by a student who enrolled in 2025 is still legacy noise by this rule: the
 * student themselves predates the system's real start, so nothing tied to them counts.
 */
export const EMS_SCOPE_START = new Date("2026-01-01T00:00:00.000Z");

/** Merge into a `Student` (or `Lead`) `where` clause. */
export const inScopeFilter = { createdAt: { gte: EMS_SCOPE_START } } as const;

/** Merge into a `Payment` / `Discount` (or anything else with a `student` relation) `where`
 * clause — scopes by the student's enrollment date, not the sub-record's own date. */
export const studentInScopeFilter = { student: { createdAt: { gte: EMS_SCOPE_START } } } as const;

/**
 * For a `Student`/`Lead` `where.createdAt` filter that also needs to respect a caller-supplied
 * date range (e.g. a report's `from`/`to`) — plain-object-spreading `inScopeFilter` alongside a
 * second `{ createdAt: range }` silently drops the scope floor, since the later key wins. This
 * combines both into one `createdAt` filter, keeping whichever lower bound is more restrictive.
 */
export function scopedCreatedAt(range?: { gte?: Date; lte?: Date }): { gte: Date; lte?: Date } {
  const gte = range?.gte && range.gte > EMS_SCOPE_START ? range.gte : EMS_SCOPE_START;
  return { gte, ...(range?.lte ? { lte: range.lte } : {}) };
}

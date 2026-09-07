/**
 * The two people this ledger is for. Zod is male, Sylvia female — noted here
 * because the pair is fixed by design rather than typed in. Nothing in the UI
 * is gendered, so only the names themselves are ever used.
 *
 * These are enforced in the database too: changing them means changing the
 * members_fixed_names check constraint and the two RPCs in
 * supabase/migrations/0001_init.sql to match.
 */
export const MEMBER_NAMES = ['Zod', 'Sylvia'] as const;

export type MemberName = (typeof MEMBER_NAMES)[number];

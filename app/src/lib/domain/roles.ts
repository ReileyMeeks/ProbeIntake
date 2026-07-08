import type { UserRole } from './types';

export function canManageUsers(role: UserRole): boolean {
	return role === 'manager' || role === 'admin';
}

export function canSeeAllAnalyses(role: UserRole): boolean {
	return role === 'manager' || role === 'admin';
}

export function canDeleteAnalysis(
	role: UserRole,
	mySub: string | undefined,
	createdBy: string | undefined
): boolean {
	if (role === 'admin') return true;
	return Boolean(mySub && createdBy && mySub === createdBy);
}

export function assignableRoles(actor: UserRole): UserRole[] {
	if (actor === 'admin') return ['individual', 'manager', 'admin'];
	return ['individual', 'manager'];
}

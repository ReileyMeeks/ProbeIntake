import { describe, it, expect } from 'vitest';
import { canManageUsers, canSeeAllAnalyses, canDeleteAnalysis, assignableRoles } from './roles';

describe('role helpers', () => {
	it('canManageUsers is manager+admin only', () => {
		expect(canManageUsers('individual')).toBe(false);
		expect(canManageUsers('manager')).toBe(true);
		expect(canManageUsers('admin')).toBe(true);
	});

	it('canSeeAllAnalyses is manager+admin', () => {
		expect(canSeeAllAnalyses('individual')).toBe(false);
		expect(canSeeAllAnalyses('manager')).toBe(true);
	});

	it('canDeleteAnalysis: creator or admin', () => {
		expect(canDeleteAnalysis('individual', 'auth0|me', 'auth0|me')).toBe(true);
		expect(canDeleteAnalysis('individual', 'auth0|me', 'auth0|other')).toBe(false);
		expect(canDeleteAnalysis('admin', 'auth0|me', 'auth0|other')).toBe(true);
	});

	it('managers cannot assign admin', () => {
		expect(assignableRoles('manager')).toEqual(['individual', 'manager']);
		expect(assignableRoles('admin')).toEqual(['individual', 'manager', 'admin']);
	});
});

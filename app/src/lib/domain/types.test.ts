import { describe, it, expect } from 'vitest';
import type { Me, AdminUser, UserRole, Comparison } from './types';

describe('domain types', () => {
	it('compiles role-shaped values', () => {
		const role: UserRole = 'manager';
		const me: Me = { id: '1', email: 'a@b.com', name: 'A', role };
		const user: AdminUser = {
			id: '2',
			email: 'c@d.com',
			name: null,
			role: 'individual',
			created_at: '2026-05-28T00:00:00Z'
		};
		const cmp: Comparison = { summaries: [], rows: [] };
		expect(me.role).toBe('manager');
		expect(user.role).toBe('individual');
		expect(cmp.rows.length).toBe(0);
	});
});

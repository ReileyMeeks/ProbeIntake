import { render, screen, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import Login from './+page.svelte';

vi.mock('$lib/api/client', () => ({ login: vi.fn(async () => true) }));

describe('login', () => {
	it('submits password', async () => {
		render(Login);
		await fireEvent.input(screen.getByLabelText(/password/i), { target: { value: 'x' } });
		await fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
		const { login } = await import('$lib/api/client');
		expect(login).toHaveBeenCalledWith('x');
	});

	it('shows an error message when the password is incorrect', async () => {
		const { login } = await import('$lib/api/client');
		vi.mocked(login).mockResolvedValueOnce(false);

		render(Login);
		await fireEvent.input(screen.getByLabelText(/password/i), { target: { value: 'wrong' } });
		await fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

		expect(await screen.findByRole('alert')).toHaveTextContent(/incorrect password/i);
	});
});

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ProtectedRoute } from '@/presentation/router/ProtectedRoute';
import { useAuthStore } from '@/presentation/store/authStore';

function renderRoute(bootstrapped: boolean, isAuthenticated: boolean) {
  useAuthStore.setState({ bootstrapped, isAuthenticated, user: isAuthenticated ? { id: '1', email: 'a@b.com', name: null, identityProvider: 'local', settings: {} } : null });
  return render(
    <MemoryRouter initialEntries={['/protected']}>
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>
    </MemoryRouter>
  );
}

describe('ProtectedRoute', () => {
  it('renders nothing while bootstrapping', () => {
    const { container } = renderRoute(false, false);
    expect(container.firstChild).toBeNull();
  });

  it('redirects to login when not authenticated and bootstrapped', () => {
    renderRoute(true, false);
    expect(screen.queryByText('Protected Content')).toBeNull();
  });

  it('renders children when authenticated', () => {
    renderRoute(true, true);
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });
});

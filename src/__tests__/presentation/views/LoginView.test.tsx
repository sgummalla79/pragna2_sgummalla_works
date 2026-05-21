import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import LoginView from '@/presentation/views/auth/LoginView';
import { ServiceContext, type Services } from '@/presentation/providers/ServiceContext';
import { useAuthStore } from '@/presentation/store/authStore';

const mockLogin = vi.fn();
const mockMe = vi.fn().mockResolvedValue({ id: '1', email: 'a@b.com', name: null, identityProvider: 'local', settings: {} });

const mockServices = {
  authService: {
    login: mockLogin,
    me: mockMe,
    register: vi.fn(),
    logout: vi.fn(),
    updateSettings: vi.fn(),
  },
  providerService: {} as never,
  modelService: {} as never,
  flowService: {} as never,
  skillService: {} as never,
  conversationService: {} as never,
} as unknown as Services;

function renderLogin() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ServiceContext.Provider value={mockServices}>
          <LoginView />
        </ServiceContext.Provider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ user: null, isAuthenticated: false, bootstrapped: true, accessToken: null });
});

describe('LoginView', () => {
  it('renders email and password fields', () => {
    renderLogin();
    expect(screen.getByLabelText('Email address')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
  });

  it('shows validation error when fields are empty', async () => {
    renderLogin();
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Email and password are required.');
    });
  });

  it('calls login with email and password on submit', async () => {
    mockLogin.mockResolvedValueOnce({ accessToken: 'tok', refreshToken: 'ref' });
    renderLogin();
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({ email: 'test@example.com', password: 'password123' });
    });
  });

  it('shows error message on login failure', async () => {
    mockLogin.mockRejectedValueOnce(new Error('Unauthorized'));
    renderLogin();
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrongpass' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Invalid email or password');
    });
  });
});

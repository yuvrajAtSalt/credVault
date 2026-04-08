import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Sign In | VaultStack',
    description: 'Sign in to your VaultStack workspace.',
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="vault-auth-shell">
            {children}
        </div>
    );
}

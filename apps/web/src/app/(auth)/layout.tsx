import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Sign In | Cred Vault',
    description: 'Sign in to your Cred Vault workspace.',
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="vault-auth-shell">
            {children}
        </div>
    );
}

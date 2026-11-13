import { RequireAuth } from '@/features/auth/components/RequireAuth';

export default function ProfiloLayout({ children }: { children: React.ReactNode }) {
  return <RequireAuth>{children}</RequireAuth>;
}

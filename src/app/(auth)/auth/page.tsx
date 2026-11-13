import { Suspense } from 'react';

import { AuthScreen } from '@/features/auth/components/AuthScreen';

export default function AuthPage() {
  return (
    <Suspense>
      <AuthScreen />
    </Suspense>
  );
}

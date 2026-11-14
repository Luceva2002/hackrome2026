import { Suspense } from 'react';

import { ManagerScreen } from '@/features/manage/ManagerScreen';

export default function ManagerPage() {
  return (
    <Suspense>
      <ManagerScreen />
    </Suspense>
  );
}

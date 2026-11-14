import { Suspense } from 'react';

import { NewActivityScreen } from '@/features/activities/components/NewActivityScreen';

export default function NewActivityPage() {
  return (
    <Suspense>
      <NewActivityScreen />
    </Suspense>
  );
}

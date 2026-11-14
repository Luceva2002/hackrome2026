import { Suspense } from 'react';

import { ActivitiesScreen } from '@/features/activities/components/ActivitiesScreen';

export default function ActivitiesPage() {
  return (
    <Suspense>
      <ActivitiesScreen />
    </Suspense>
  );
}

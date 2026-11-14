import { Suspense } from 'react';

import { ExploreScreen } from '@/features/venues/components/ExploreScreen';

export default function MapPage() {
  return (
    <Suspense>
      <ExploreScreen />
    </Suspense>
  );
}

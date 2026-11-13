import { Suspense } from 'react';

import { ExploreScreen } from '@/features/venues/components/ExploreScreen';

export default function HomePage() {
  return (
    <Suspense>
      <ExploreScreen />
    </Suspense>
  );
}

import { ActivityDetailScreen } from '@/features/activities/components/ActivityDetailScreen';

export default async function ActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ActivityDetailScreen id={id} />;
}

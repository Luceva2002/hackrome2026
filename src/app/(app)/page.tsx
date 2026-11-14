import { redirect } from 'next/navigation';

/** L'app si apre sulla mappa: è il centro dell'esperienza. La Home è in /inizio. */
export default function RootPage() {
  redirect('/mappa');
}

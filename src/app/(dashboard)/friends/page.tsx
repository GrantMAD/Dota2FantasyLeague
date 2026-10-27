import { Suspense } from 'react';
import FriendsPageClient from './FriendsPageClient';

export default function FriendsPage() {
  return (
    <Suspense fallback={null}>
      <FriendsPageClient />
    </Suspense>
  );
}

'use client';

import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { useTour } from '@/context/TourContext';

const LazyPageTour = dynamic(
  () => import('./PageTour').then((module) => module.PageTour),
  { ssr: false },
);

const LazyPageGuideModal = dynamic(
  () => import('./PageGuideModal').then((module) => module.PageGuideModal),
  { ssr: false },
);

export function TourOverlays() {
  const { isOpen, isGuideOpen } = useTour();
  const searchParams = useSearchParams();
  const shouldLoadGuide = isGuideOpen || searchParams.get('guide') === '1';

  return (
    <>
      {isOpen && <LazyPageTour />}
      {shouldLoadGuide && <LazyPageGuideModal />}
    </>
  );
}

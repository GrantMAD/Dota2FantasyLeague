import type { Metadata } from 'next';
import RulesPageClient from './RulesPageClient';

export const metadata: Metadata = {
  title: 'Game Rules & Scoring | Fantasy Dota 2',
  description: 'Read the Fantasy Dota 2 rules for squad building, captaincy, scoring, chips, transfers, and gameweek deadlines.',
};

export default function RulesPage() {
  return <RulesPageClient />;
}

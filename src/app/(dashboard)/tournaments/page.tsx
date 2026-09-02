'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

interface Tournament {
  id: number;
  name: string;
  slug: string;
  status: 'eligible' | 'excluded' | 'provisional' | 'archived';
  tier: string | null;
  start_date: string;
  end_date: string;
}

export default function TournamentsHubPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // In a real implementation this would fetch from /api/tournaments
    const fetchTournaments = async () => {
      try {
        const response = await fetch('/api/tournaments');
        if (response.ok) {
          const data = await response.json();
          setTournaments(data.data || data); // Depending on API response format
        }
      } catch (error) {
        console.error('Error fetching tournaments', error);
      } finally {
        setLoading(false);
      }
    };
    fetchTournaments();
  }, []);

  const getTierBadgeColor = (tier: string | null) => {
    if (!tier) return 'bg-slate-700 text-slate-300';
    if (tier.toLowerCase().includes('tier 1') || tier.toLowerCase().includes('major')) {
      return 'bg-amber-500/20 text-amber-500 border border-amber-500/30';
    }
    if (tier.toLowerCase().includes('tier 2') || tier.toLowerCase().includes('minor')) {
      return 'bg-blue-500/20 text-blue-400 border border-blue-500/30';
    }
    return 'bg-slate-700 text-slate-300';
  };

  const getStatusBadgeColor = (status: string) => {
    if (status === 'eligible') return 'bg-green-500/20 text-green-400 border border-green-500/30';
    if (status === 'archived') return 'bg-slate-500/20 text-slate-400 border border-slate-500/30';
    return 'bg-slate-700 text-slate-300';
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-white mb-2">Tournaments Hub</h1>
      <p className="text-slate-400 mb-8">View eligible professional tournaments and their schedules.</p>

      {loading ? (
        <div className="flex justify-center items-center py-24">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-500"></div>
        </div>
      ) : tournaments.length === 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-12 text-center">
          <p className="text-slate-400 text-lg">No tournaments found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tournaments.map((tournament) => (
            <Link 
              href={`/tournaments/${tournament.id}`} 
              key={tournament.id}
              className="bg-slate-800/40 border border-slate-700 rounded-lg p-6 hover:bg-slate-800 hover:border-slate-600 transition-colors block group"
            >
              <div className="flex justify-between items-start mb-4">
                <span className={`text-xs px-2 py-1 rounded-full ${getTierBadgeColor(tournament.tier)}`}>
                  {tournament.tier || 'Unranked'}
                </span>
                <span className={`text-xs px-2 py-1 rounded-full ${getStatusBadgeColor(tournament.status)}`}>
                  {tournament.status.charAt(0).toUpperCase() + tournament.status.slice(1)}
                </span>
              </div>
              
              <h2 className="text-xl font-semibold text-white mb-2 group-hover:text-amber-500 transition-colors">
                {tournament.name}
              </h2>
              
              <div className="text-sm text-slate-400 flex items-center mb-4">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                </svg>
                {new Date(tournament.start_date).toLocaleDateString()} - {new Date(tournament.end_date).toLocaleDateString()}
              </div>

              <div className="mt-4 pt-4 border-t border-slate-700 flex justify-between items-center text-sm">
                <span className="text-slate-300 group-hover:text-amber-400 transition-colors">View Matches</span>
                <svg className="w-5 h-5 text-slate-500 group-hover:text-amber-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
                </svg>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

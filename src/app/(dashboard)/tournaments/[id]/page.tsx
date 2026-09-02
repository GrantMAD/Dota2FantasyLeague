'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';

interface Match {
  id: number;
  team_a_name: string;
  team_a_logo: string | null;
  team_b_name: string;
  team_b_logo: string | null;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'postponed';
  scheduled_time: string;
  winner_team_id: number | null;
  team_a_id: number;
  team_b_id: number;
}

interface TournamentDetail {
  id: number;
  name: string;
  slug: string;
  status: 'eligible' | 'excluded' | 'provisional' | 'archived';
  tier: string | null;
  start_date: string;
  end_date: string;
  matches?: Match[];
}

export default function TournamentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const tournamentId = resolvedParams.id;
  const [tournament, setTournament] = useState<TournamentDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // In a real implementation this would fetch from /api/tournaments/[id]
    const fetchTournament = async () => {
      try {
        const response = await fetch(`/api/tournaments/${tournamentId}`);
        if (response.ok) {
          const data = await response.json();
          setTournament(data.data || data);
        }
      } catch (error) {
        console.error('Error fetching tournament details', error);
      } finally {
        setLoading(false);
      }
    };
    fetchTournament();
  }, [tournamentId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24 min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-500"></div>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 text-center">
        <h1 className="text-3xl font-bold text-white mb-4">Tournament Not Found</h1>
        <p className="text-slate-400 mb-8">The tournament you are looking for does not exist or has been removed.</p>
        <Link href="/tournaments" className="text-amber-500 hover:text-amber-400 underline">
          &larr; Back to Tournaments Hub
        </Link>
      </div>
    );
  }

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

  const matches = tournament.matches || [];

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <Link href="/tournaments" className="inline-flex items-center text-slate-400 hover:text-white transition-colors mb-6">
        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
        </svg>
        Back to Tournaments
      </Link>

      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-8 mb-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <h1 className="text-3xl md:text-4xl font-bold text-white">
            {tournament.name}
          </h1>
          <div className="flex gap-2">
            <span className={`text-sm px-3 py-1 rounded-full font-medium ${getTierBadgeColor(tournament.tier)}`}>
              {tournament.tier || 'Unranked'}
            </span>
            <span className="text-sm px-3 py-1 rounded-full font-medium bg-slate-700 text-slate-300">
              {tournament.status.charAt(0).toUpperCase() + tournament.status.slice(1)}
            </span>
          </div>
        </div>

        <div className="flex items-center text-slate-400">
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
          </svg>
          {new Date(tournament.start_date).toLocaleDateString()} &mdash; {new Date(tournament.end_date).toLocaleDateString()}
        </div>
      </div>

      <h2 className="text-2xl font-semibold text-white mb-6">Matches</h2>
      
      {matches.length === 0 ? (
        <div className="bg-slate-800/30 border border-slate-700 border-dashed rounded-lg p-12 text-center text-slate-400">
          No matches found for this tournament yet.
        </div>
      ) : (
        <div className="space-y-4">
          {matches.map((match) => (
            <div key={match.id} className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 flex flex-col md:flex-row items-center justify-between gap-4">
              
              {/* Match Time & Status */}
              <div className="flex flex-col w-full md:w-1/4 text-center md:text-left">
                <span className="text-slate-300 font-medium">
                  {new Date(match.scheduled_time).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className={`text-xs mt-1 font-medium ${match.status === 'completed' ? 'text-slate-400' : match.status === 'in_progress' ? 'text-red-400 animate-pulse' : 'text-amber-400'}`}>
                  {match.status.replace('_', ' ').toUpperCase()}
                </span>
              </div>

              {/* Teams & Score Placeholder */}
              <div className="flex items-center justify-center w-full md:w-2/4 gap-4">
                <div className={`flex flex-col items-center w-32 text-center ${match.winner_team_id && match.winner_team_id === match.team_a_id ? 'font-bold text-white' : 'text-slate-300'}`}>
                  <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center mb-2 overflow-hidden">
                    {match.team_a_logo ? <img src={match.team_a_logo} alt={match.team_a_name} className="w-full h-full object-contain" /> : <span className="text-xs">LOGO</span>}
                  </div>
                  <span className="text-sm truncate w-full">{match.team_a_name || 'TBD'}</span>
                </div>
                
                <div className="text-slate-500 font-bold mx-2">vs</div>

                <div className={`flex flex-col items-center w-32 text-center ${match.winner_team_id && match.winner_team_id === match.team_b_id ? 'font-bold text-white' : 'text-slate-300'}`}>
                  <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center mb-2 overflow-hidden">
                    {match.team_b_logo ? <img src={match.team_b_logo} alt={match.team_b_name} className="w-full h-full object-contain" /> : <span className="text-xs">LOGO</span>}
                  </div>
                  <span className="text-sm truncate w-full">{match.team_b_name || 'TBD'}</span>
                </div>
              </div>

              {/* Action Button */}
              <div className="w-full md:w-1/4 flex justify-end">
                <Link 
                  href={`/matches/${match.id}`}
                  className="px-4 py-2 border border-slate-600 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-md transition-colors w-full md:w-auto text-center"
                >
                  View Details
                </Link>
              </div>

            </div>
          ))}
        </div>
      )}
    </div>
  );
}

import React from 'react';

export default function RulesPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-white mb-2">Game Rules & Scoring Guide</h1>
      <p className="text-slate-400 mb-8">Everything you need to know to master Fantasy Dota 2.</p>

      <div className="space-y-8">
        {/* Core Concepts */}
        <section className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 sm:p-8">
          <h2 className="text-2xl font-semibold text-amber-500 mb-4">Core Concepts</h2>
          <div className="space-y-4 text-slate-300">
            <p>
              <strong className="text-white">Squad Building:</strong> You start with a $100.0M budget to draft 8 professional players. Your starting lineup consists of exactly 5 players (Carry, Mid, Offlane, Support, Hard Support). The remaining 3 players sit on your bench.
            </p>
            <p>
              <strong className="text-white">Captain & Vice-Captain:</strong> Select a Captain each Gameweek. Your Captain earns <strong>2.0x</strong> fantasy points. If your Captain does not play, your Vice-Captain will receive the multiplier instead.
            </p>
            <p>
              <strong className="text-white">Transfers:</strong> You receive 1 free transfer per Gameweek. Unused free transfers roll over (max 2 banked). Any additional transfers cost a 4-point penalty per transfer.
            </p>
          </div>
        </section>

        {/* Scoring System */}
        <section className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 sm:p-8">
          <h2 className="text-2xl font-semibold text-amber-500 mb-4">Scoring System</h2>
          
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-medium text-white mb-3">Combat</h3>
              <ul className="list-disc list-inside space-y-1 text-slate-300 ml-2">
                <li>Kill: <span className="text-green-400">+1.5</span></li>
                <li>Assist: <span className="text-green-400">+0.75</span></li>
                <li>Death: <span className="text-red-400">-1.0</span></li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-xl font-medium text-white mb-3">Match Result</h3>
              <ul className="list-disc list-inside space-y-1 text-slate-300 ml-2">
                <li>Game Win: <span className="text-green-400">+5.0</span></li>
                <li>Series Win Bonus: <span className="text-green-400">+3.0</span></li>
              </ul>
            </div>

            <div>
              <h3 className="text-xl font-medium text-white mb-3">Performance & Economy</h3>
              <p className="text-slate-300 mb-2">
                Players earn dynamic points based on their role and match length. A Hard Support isn't expected to have the same GPM as a Carry, so economy and objective points are normalized.
              </p>
              <ul className="list-disc list-inside space-y-1 text-slate-300 ml-2">
                <li>Performance Index Bonus: Up to <span className="text-green-400">+5.0</span> for exceptional role execution.</li>
                <li>Consistency Bonus: <span className="text-green-400">+1.2</span> for consistently high average performance.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Special Chips */}
        <section className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 sm:p-8">
          <h2 className="text-2xl font-semibold text-amber-500 mb-4">Special Chips</h2>
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-bold text-white flex items-center">
                Wildcard
                <span className="ml-2 text-xs font-normal px-2 py-1 bg-amber-500/20 text-amber-400 rounded-full border border-amber-500/30">1 per season</span>
              </h3>
              <p className="text-slate-300 mt-2">
                Allows you to make unlimited free transfers for a single Gameweek. Use this to overhaul your squad without taking point penalties.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-bold text-white flex items-center">
                Triple Captain
                <span className="ml-2 text-xs font-normal px-2 py-1 bg-amber-500/20 text-amber-400 rounded-full border border-amber-500/30">1 per season</span>
              </h3>
              <p className="text-slate-300 mt-2">
                Your captain earns 3.0x points instead of the usual 2.0x for the selected Gameweek.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-bold text-white flex items-center">
                Bench Boost
                <span className="ml-2 text-xs font-normal px-2 py-1 bg-amber-500/20 text-amber-400 rounded-full border border-amber-500/30">1 per season</span>
              </h3>
              <p className="text-slate-300 mt-2">
                Points scored by your bench players are added to your Gameweek total. Normally, bench players only score if a starter doesn't play.
              </p>
            </div>
          </div>
        </section>
        
        {/* Deadlines & Price Changes */}
        <section className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 sm:p-8">
          <h2 className="text-2xl font-semibold text-amber-500 mb-4">Deadlines & Price Changes</h2>
          <div className="space-y-4 text-slate-300">
            <p>
              <strong className="text-white">Deadlines:</strong> Transfers and squad changes lock 30 minutes before the first eligible match of the Gameweek. Once locked, no changes can be made until the Gameweek ends.
            </p>
            <p>
              <strong className="text-white">Price Changes:</strong> Player prices are dynamic and update at the end of each Gameweek based on performance, form, and transfer market activity. Buying early before a price rises increases your squad's total value over the season.
            </p>
          </div>
        </section>

      </div>
    </div>
  );
}

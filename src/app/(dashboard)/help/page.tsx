'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

const FAQItem = ({ question, answer }: { question: string; answer: React.ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div className="border border-slate-700 rounded-lg bg-slate-800/30 overflow-hidden">
      <button 
        className="w-full flex items-center justify-between p-4 text-left focus:outline-none focus:bg-slate-800/80 hover:bg-slate-800/50 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="font-medium text-white">{question}</span>
        {isOpen ? <ChevronUp className="w-5 h-5 text-amber-500" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
      </button>
      {isOpen && (
        <div className="p-4 bg-slate-800/20 border-t border-slate-700 text-slate-300 text-sm leading-relaxed">
          {answer}
        </div>
      )}
    </div>
  );
};

export default function HelpPage() {
  const faqs = [
    {
      question: "How do I join a league?",
      answer: "Navigate to the Leagues page from the sidebar. You can browse public leagues or join a private league by entering the invite code provided by the league creator."
    },
    {
      question: "Why didn't my player score any points?",
      answer: "Players only score points for eligible matches within a gameweek. Make sure the player actually played a match. If they were benched in real life, your bench substitute will automatically replace them if possible."
    },
    {
      question: "What happens if there's a tie in head-to-head?",
      answer: "In a head-to-head league, if both participants score the exact same amount of fantasy points, the match ends in a draw and both participants receive 1 league point."
    },
    {
      question: "Can a player have multiple roles?",
      answer: "Some players may be eligible for multiple roles (e.g., Mid and Carry). You can play them in any of their eligible positions."
    },
    {
      question: "When are points calculated?",
      answer: "Fantasy points are calculated shortly after a professional match concludes. However, league standings and global rankings are updated when the Gameweek is fully closed and locked."
    }
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-white mb-2">Help Center & FAQ</h1>
      <p className="text-slate-400 mb-8">Find answers, onboarding guides, and support.</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Left column: FAQ */}
        <div className="md:col-span-2 space-y-6">
          <h2 className="text-2xl font-semibold text-amber-500 mb-4">Frequently Asked Questions</h2>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <FAQItem key={i} question={faq.question} answer={faq.answer} />
            ))}
          </div>
        </div>

        {/* Right column: Guides & Support */}
        <div className="space-y-6">
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-3">Onboarding Guide</h3>
            <p className="text-slate-400 text-sm mb-4">
              New to Fantasy Dota 2? Learn how to draft your first squad, navigate the transfer market, and understand player pricing.
            </p>
            <a href="/rules" className="inline-block px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold rounded-md transition-colors text-sm">
              Read the Rules
            </a>
          </div>

          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-3">Role Eligibility</h3>
            <p className="text-slate-400 text-sm mb-4">
              Your squad must have exactly 1 Carry, 1 Mid, 1 Offlane, 1 Support, and 1 Hard Support. Bench players can be any role.
            </p>
          </div>

          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-3">Still need help?</h3>
            <p className="text-slate-400 text-sm mb-4">
              If you found a bug or have an account issue, please reach out to support.
            </p>
            <button className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-md transition-colors text-sm">
              Contact Support
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

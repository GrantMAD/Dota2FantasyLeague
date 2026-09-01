'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchNotifications() {
      try {
        const res = await fetch('/api/notifications');
        const data = await res.json();
        setNotifications(data.notifications || []);
      } catch (err: any) {
        setError(err.message || 'Failed to load notifications');
      } finally {
        setLoading(false);
      }
    }
    fetchNotifications();
  }, []);

  const handleMarkAsRead = async (id: number) => {
    try {
      const res = await fetch(`/api/notifications/${id}/read`, { method: 'PUT' });
      if (res.ok) {
        setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: true } : n));
      }
    } catch (e) {
      console.error('Failed to mark read', e);
    }
  };

  const getIconForType = (type: string) => {
    switch (type) {
      case 'gameweek_deadline':
        return (
          <div className="w-10 h-10 rounded-full bg-red-500/20 text-red-500 flex items-center justify-center border border-red-500/30">
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          </div>
        );
      case 'price_change':
        return (
          <div className="w-10 h-10 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center border border-amber-500/30">
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          </div>
        );
      case 'rank_movement':
        return (
          <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center border border-emerald-500/30">
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>
          </div>
        );
      case 'parent_welcome': // Included for historical reasons per user rule
        return (
          <div className="w-10 h-10 rounded-full bg-blue-500/20 text-blue-500 flex items-center justify-center border border-blue-500/30">
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          </div>
        );
      default:
        return (
          <div className="w-10 h-10 rounded-full bg-slate-700 text-slate-300 flex items-center justify-center border border-slate-600">
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          </div>
        );
    }
  };

  const timeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Notifications</h1>
          <p className="text-slate-400">Stay updated on your fantasy team</p>
        </div>
        
        {notifications.some(n => !n.is_read) && (
           <button className="text-sm font-medium text-amber-500 hover:text-amber-400 transition-colors bg-amber-500/10 hover:bg-amber-500/20 px-4 py-2 rounded-lg border border-amber-500/20">
              Mark all as read
           </button>
        )}
      </div>

      {error && (
        <div className="bg-red-900/50 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg mb-8 text-sm">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {loading ? (
          [1, 2, 3, 4].map(i => (
             <div key={i} className="animate-pulse bg-slate-800/50 rounded-xl h-24 border border-slate-700"></div>
          ))
        ) : notifications.length === 0 ? (
          <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-12 text-center">
             <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-700">
                <svg className="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
             </div>
             <h3 className="text-lg font-medium text-white mb-1">You're all caught up!</h3>
             <p className="text-slate-400">You don't have any notifications right now.</p>
          </div>
        ) : (
          notifications.map((notif) => (
            <div 
               key={notif.id} 
               className={`flex gap-4 p-5 rounded-xl border transition-all ${
                  !notif.is_read 
                     ? 'bg-slate-800/80 border-slate-600 shadow-md' 
                     : 'bg-slate-800/30 border-slate-700/50 opacity-70'
               }`}
            >
               <div className="shrink-0 pt-1">
                  {getIconForType(notif.type)}
               </div>
               
               <div className="flex-1">
                  <div className="flex justify-between items-start mb-1">
                     <h3 className={`font-semibold ${!notif.is_read ? 'text-white' : 'text-slate-300'}`}>
                        {notif.title}
                     </h3>
                     <span className="text-xs font-medium text-slate-500 whitespace-nowrap ml-4">
                        {timeAgo(notif.created_at)}
                     </span>
                  </div>
                  <p className="text-sm text-slate-400">{notif.message}</p>
                  
                  {notif.type === 'parent_welcome' && (
                     <div className="mt-3">
                        <Link href="/mychildren" className="text-xs font-medium bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 px-3 py-1.5 rounded border border-blue-500/30 transition-colors">
                           Go to MyChildren
                        </Link>
                     </div>
                  )}
               </div>
               
               {!notif.is_read && (
                  <div className="shrink-0 flex items-center justify-center">
                     <button 
                        onClick={() => handleMarkAsRead(notif.id)}
                        className="w-8 h-8 rounded-full bg-slate-700 hover:bg-emerald-600 text-slate-400 hover:text-white flex items-center justify-center transition-colors border border-slate-600 hover:border-emerald-500"
                        title="Mark as read"
                     >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                     </button>
                  </div>
               )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTheme, type Theme } from '@/components/theme/ThemeProvider';

export default function SettingsPage() {
   const { theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState('profile');
  
  // Mock form state
  const [formData, setFormData] = useState({
     displayName: 'Grant',
     country: 'US',
     emailNotifications: true,
     pushNotifications: true
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
        <p className="text-slate-400">Manage your account and preferences</p>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
         {/* Settings Sidebar */}
         <div className="w-full md:w-64 shrink-0">
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
               <button 
                  onClick={() => setActiveTab('profile')}
                  className={`w-full text-left px-5 py-4 text-sm font-medium transition-colors border-l-2 ${activeTab === 'profile' ? 'bg-slate-700/50 border-amber-500 text-white' : 'border-transparent text-slate-400 hover:bg-slate-700/30 hover:text-slate-300'}`}
               >
                  Edit Profile
               </button>
               <button 
                  onClick={() => setActiveTab('notifications')}
                  className={`w-full text-left px-5 py-4 text-sm font-medium transition-colors border-l-2 ${activeTab === 'notifications' ? 'bg-slate-700/50 border-amber-500 text-white' : 'border-transparent text-slate-400 hover:bg-slate-700/30 hover:text-slate-300'}`}
               >
                  Notifications
               </button>
               <button 
                  onClick={() => setActiveTab('security')}
                  className={`w-full text-left px-5 py-4 text-sm font-medium transition-colors border-l-2 ${activeTab === 'security' ? 'bg-slate-700/50 border-amber-500 text-white' : 'border-transparent text-slate-400 hover:bg-slate-700/30 hover:text-slate-300'}`}
               >
                  Security
               </button>
            </div>
         </div>
         
         {/* Settings Content */}
         <div className="flex-1">
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 md:p-8">
               
               {activeTab === 'profile' && (
                  <div>
                     <h2 className="text-xl font-bold text-white mb-6">Profile Information</h2>
                     
                     <div className="space-y-6">
                        <div>
                           <label className="block text-sm font-medium text-slate-300 mb-2">Display Name</label>
                           <input 
                              type="text" 
                              value={formData.displayName}
                              onChange={(e) => setFormData({...formData, displayName: e.target.value})}
                              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-amber-500 transition-colors"
                           />
                           <p className="text-xs text-slate-500 mt-2">This is how you appear on the leaderboard.</p>
                        </div>
                        
                        <div>
                           <label className="block text-sm font-medium text-slate-300 mb-2">Country / Region</label>
                           <select 
                              value={formData.country}
                              onChange={(e) => setFormData({...formData, country: e.target.value})}
                              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-amber-500 transition-colors"
                           >
                              <option value="US">United States</option>
                              <option value="UK">United Kingdom</option>
                              <option value="CN">China</option>
                              <option value="RU">Russia</option>
                           </select>
                        </div>
                        
                        <div className="pt-4 border-t border-slate-700">
                           <button className="bg-amber-600 hover:bg-amber-500 text-white px-6 py-2.5 rounded-lg font-medium transition-colors">
                              Save Changes
                           </button>
                        </div>
                     </div>
                  </div>
               )}
               
               {activeTab === 'notifications' && (
                  <div>
                     <h2 className="text-xl font-bold text-white mb-6">Notification Preferences</h2>
                     
                     <div className="space-y-6">
                        <div className="flex items-center justify-between">
                           <div>
                              <h4 className="text-white font-medium">Push Notifications</h4>
                              <p className="text-sm text-slate-400">Receive alerts on your device for deadlines and price changes.</p>
                           </div>
                           <button 
                              onClick={() => setFormData({...formData, pushNotifications: !formData.pushNotifications})}
                              className={`w-12 h-6 rounded-full transition-colors relative ${formData.pushNotifications ? 'bg-amber-500' : 'bg-slate-600'}`}
                           >
                              <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all ${formData.pushNotifications ? 'left-7' : 'left-1'}`}></div>
                           </button>
                        </div>
                        
                        <div className="flex items-center justify-between pt-6 border-t border-slate-700">
                           <div>
                              <h4 className="text-white font-medium">Email Notifications</h4>
                              <p className="text-sm text-slate-400">Receive weekly summaries and important account updates.</p>
                           </div>
                           <button 
                              onClick={() => setFormData({...formData, emailNotifications: !formData.emailNotifications})}
                              className={`w-12 h-6 rounded-full transition-colors relative ${formData.emailNotifications ? 'bg-amber-500' : 'bg-slate-600'}`}
                           >
                              <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all ${formData.emailNotifications ? 'left-7' : 'left-1'}`}></div>
                           </button>
                        </div>
                     </div>
                  </div>
               )}

               {activeTab === 'profile' && (
                  <div className="mt-8 border-t border-slate-700 pt-6">
                     <h2 className="text-xl font-bold text-white mb-2">Appearance</h2>
                     <p className="text-sm text-slate-400 mb-4">Choose the Competitive Esports interface theme for your account.</p>
                     <div className="grid grid-cols-2 gap-3">
                        {(['light', 'dark'] as Theme[]).map((option) => (
                           <button
                              key={option}
                              type="button"
                              onClick={() => void setTheme(option)}
                              className={`rounded-lg border px-4 py-3 text-left text-sm font-medium capitalize transition-colors ${theme === option ? 'border-amber-500 bg-amber-500/10 text-amber-500' : 'border-slate-700 bg-slate-900/40 text-slate-300 hover:border-slate-500'}`}
                           >
                              {option} mode
                           </button>
                        ))}
                     </div>
                  </div>
               )}
               
               {activeTab === 'security' && (
                  <div>
                     <h2 className="text-xl font-bold text-white mb-6">Security Settings</h2>
                     
                     <div className="space-y-6">
                        <div>
                           <label className="block text-sm font-medium text-slate-300 mb-2">Current Password</label>
                           <input 
                              type="password" 
                              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-amber-500 transition-colors"
                           />
                        </div>
                        <div>
                           <label className="block text-sm font-medium text-slate-300 mb-2">New Password</label>
                           <input 
                              type="password" 
                              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-amber-500 transition-colors"
                           />
                        </div>
                        
                        <div className="pt-4 border-t border-slate-700">
                           <button className="bg-slate-700 hover:bg-slate-600 text-white px-6 py-2.5 rounded-lg font-medium transition-colors">
                              Update Password
                           </button>
                        </div>
                     </div>
                  </div>
               )}
               
            </div>
         </div>
      </div>
    </div>
  );
}

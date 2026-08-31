'use client';

export default function AccountPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-white mb-8">Account Settings</h1>

      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-8 max-w-2xl">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Username
            </label>
            <input
              type="text"
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-amber-500"
              placeholder="Your username"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Email
            </label>
            <input
              type="email"
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-amber-500"
              placeholder="your@email.com"
              disabled
            />
          </div>

          <div className="pt-6 border-t border-slate-700">
            <button className="bg-linear-to-r from-amber-500 to-orange-600 text-white px-6 py-2 rounded-lg font-semibold">
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

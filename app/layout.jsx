import './globals.css';

export const metadata = {
  title: 'Coaching Feed',
  description: 'Realtime coaching feed',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900">
        <nav className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <a href="/" className="text-xl font-bold text-indigo-600 tracking-tight">
            Coaching Feed
          </a>
          <a
            href="/admin"
            className="text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors"
          >
            Admin
          </a>
        </nav>
        <main className="max-w-3xl mx-auto px-4 py-8">{children}</main>
      </body>
    </html>
  );
}

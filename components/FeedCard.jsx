'use client';

export default function FeedCard({ post, isNew = false }) {
  const date = new Date(post.created_at);
  const formatted = date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <article
      className={`bg-white rounded-xl border border-slate-200 p-5 shadow-sm transition-all duration-500 ${
        isNew ? 'ring-2 ring-indigo-400 ring-offset-1' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-800 leading-snug">{post.title}</h2>
        {isNew && (
          <span className="shrink-0 text-xs font-medium bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
            New
          </span>
        )}
      </div>
      <p className="mt-2 text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
        {post.content}
      </p>
      <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
        <span className="font-medium text-slate-500">{post.author}</span>
        <span>{formatted}</span>
      </div>
    </article>
  );
}

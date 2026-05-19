'use client';

import { useState } from 'react';

export default function PostForm({ initial = {}, onSubmit, onCancel, loading }) {
  const [title, setTitle] = useState(initial.title || '');
  const [content, setContent] = useState(initial.content || '');
  const [author, setAuthor] = useState(initial.author || '');

  function handleSubmit(e) {
    e.preventDefault();
    onSubmit({ title, content, author });
  }

  const isEdit = Boolean(initial.id);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          required
          placeholder="e.g. Hip hinge mechanics"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <p className="text-right text-xs text-slate-400 mt-0.5">{title.length}/200</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Content</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={5000}
          required
          rows={5}
          placeholder="Write your coaching tip..."
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
        />
        <p className="text-right text-xs text-slate-400 mt-0.5">{content.length}/5000</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Author</label>
        <input
          type="text"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          maxLength={100}
          required
          placeholder="e.g. Coach Ravi"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 bg-indigo-600 text-white text-sm font-semibold py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Saving...' : isEdit ? 'Save Changes' : 'Post to Feed'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 border border-slate-300 text-slate-600 text-sm font-medium py-2 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { getFeed, createPost, updatePost, deletePost, getDevToken } from '@/lib/api';
import PostForm from '@/components/PostForm';
import FeedCard from '@/components/FeedCard';

export default function AdminPage() {
  const [token, setToken] = useState('');
  const [tokenInput, setTokenInput] = useState('');
  const [authed, setAuthed] = useState(false);

  const [posts, setPosts] = useState([]);
  const [meta, setMeta] = useState({ page: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [loadingFeed, setLoadingFeed] = useState(false);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const [editingPost, setEditingPost] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');

  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [flash, setFlash] = useState('');

  function showFlash(msg) {
    setFlash(msg);
    setTimeout(() => setFlash(''), 3000);
  }

  async function handleGetDevToken() {
    try {
      const data = await getDevToken();
      if (data.token) {
        setToken(data.token);
        setAuthed(true);
        showFlash('Admin token fetched successfully');
      }
    } catch {
      showFlash('Failed to fetch dev token — is backend running?');
    }
  }

  function handleManualToken() {
    if (!tokenInput.trim()) return;
    setToken(tokenInput.trim());
    setAuthed(true);
    showFlash('Token saved');
  }

  async function loadPosts(p) {
    setLoadingFeed(true);
    try {
      const res = await getFeed(p, 20);
      setPosts(res.data);
      setMeta(res.meta);
    } finally {
      setLoadingFeed(false);
    }
  }

  useEffect(() => {
    if (authed) loadPosts(page);
  }, [authed, page]);

  async function handleCreate(body) {
    setCreating(true);
    setCreateError('');
    try {
      const res = await createPost(token, body);
      if (res.error) {
        setCreateError(res.details?.join(', ') || res.error);
        return;
      }
      setShowCreateForm(false);
      showFlash('Post created');
      setPage(1);
      loadPosts(1);
    } catch {
      setCreateError('Network error — try again');
    } finally {
      setCreating(false);
    }
  }

  async function handleUpdate(body) {
    setSaving(true);
    setEditError('');
    try {
      const res = await updatePost(token, editingPost.id, body);
      if (res.error) {
        setEditError(res.details?.join(', ') || res.error);
        return;
      }
      setEditingPost(null);
      showFlash('Post updated');
      loadPosts(page);
    } catch {
      setEditError('Network error — try again');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    setDeleting(true);
    try {
      await deletePost(token, id);
      setDeleteConfirm(null);
      showFlash('Post deleted');
      loadPosts(page);
    } catch {
      showFlash('Failed to delete post');
    } finally {
      setDeleting(false);
    }
  }

  const totalPages = Math.ceil(meta.total / 20);

  // ── Token gate ──────────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <div className="max-w-md mx-auto mt-16">
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Admin Login</h1>
        <p className="text-sm text-slate-500 mb-8">
          Use the dev shortcut to auto-fetch a token, or paste your own.
        </p>

        {flash && (
          <div className="mb-4 p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-sm text-indigo-700">
            {flash}
          </div>
        )}

        <button
          onClick={handleGetDevToken}
          className="w-full bg-indigo-600 text-white text-sm font-semibold py-2.5 rounded-lg hover:bg-indigo-700 transition-colors mb-6"
        >
          Get Dev Token (localhost only)
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px bg-slate-200" />
          <span className="text-xs text-slate-400">or paste token</span>
          <div className="flex-1 h-px bg-slate-200" />
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="Bearer token..."
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <button
            onClick={handleManualToken}
            className="bg-slate-800 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-slate-700 transition-colors"
          >
            Login
          </button>
        </div>
      </div>
    );
  }

  // ── Admin dashboard ─────────────────────────────────────────────────────────
  return (
    <div>
      {/* Flash */}
      {flash && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white text-sm font-medium px-4 py-2.5 rounded-lg shadow-lg">
          {flash}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Admin Dashboard</h1>
          <p className="text-sm text-slate-400 mt-0.5">{meta.total} posts total</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setShowCreateForm(!showCreateForm);
              setCreateError('');
            }}
            className="bg-indigo-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            {showCreateForm ? 'Cancel' : '+ New Post'}
          </button>
          <button
            onClick={() => { setAuthed(false); setToken(''); }}
            className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Create form */}
      {showCreateForm && (
        <div className="bg-white rounded-xl border border-indigo-200 p-6 mb-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Create New Post</h2>
          {createError && (
            <p className="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {createError}
            </p>
          )}
          <PostForm
            onSubmit={handleCreate}
            onCancel={() => { setShowCreateForm(false); setCreateError(''); }}
            loading={creating}
          />
        </div>
      )}

      {/* Edit modal */}
      {editingPost && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40 px-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl">
            <h2 className="text-base font-semibold text-slate-800 mb-4">Edit Post</h2>
            {editError && (
              <p className="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {editError}
              </p>
            )}
            <PostForm
              initial={editingPost}
              onSubmit={handleUpdate}
              onCancel={() => { setEditingPost(null); setEditError(''); }}
              loading={saving}
            />
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40 px-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl text-center">
            <p className="text-2xl mb-3">🗑️</p>
            <h2 className="text-base font-semibold text-slate-800 mb-2">Delete this post?</h2>
            <p className="text-sm text-slate-500 mb-6">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button
                onClick={() => handleDelete(deleteConfirm)}
                disabled={deleting}
                className="flex-1 bg-red-600 text-white text-sm font-semibold py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 border border-slate-300 text-slate-600 text-sm font-medium py-2 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Posts list */}
      {loadingFeed ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-5 animate-pulse">
              <div className="h-4 bg-slate-200 rounded w-2/3 mb-3" />
              <div className="h-3 bg-slate-100 rounded w-full mb-2" />
              <div className="h-3 bg-slate-100 rounded w-4/5" />
            </div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p className="font-medium">No posts yet — create the first one above.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <div key={post.id} className="relative group">
              <FeedCard post={post} />
              <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => { setEditingPost(post); setEditError(''); }}
                  className="bg-white border border-slate-200 text-slate-600 text-xs font-medium px-3 py-1.5 rounded-lg shadow-sm hover:bg-slate-50 transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => setDeleteConfirm(post.id)}
                  className="bg-white border border-red-200 text-red-500 text-xs font-medium px-3 py-1.5 rounded-lg shadow-sm hover:bg-red-50 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-3">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 text-sm rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>
          <span className="text-sm text-slate-500">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 text-sm rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

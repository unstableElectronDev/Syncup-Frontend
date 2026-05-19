'use client';

import { useState, useEffect, useRef } from 'react';
import { getFeed } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import FeedCard from '@/components/FeedCard';

const LIMIT = 20;

// Module-level: survives navigation (component unmount/remount) within the same tab.
// Tracks the created_at of the newest post we've seen, so we can sync missed
// posts when the component remounts after the user navigated away to /admin.
let lastSeenAt = null;

export default function HomePage() {
  const [feed, setFeed] = useState([]);
  const [meta, setMeta] = useState({ page: 1, total: 0, source: '' });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);
  const [newIds, setNewIds] = useState(new Set());

  const seenEventIds = useRef(new Set());
  const pageRef = useRef(1);

  useEffect(() => { pageRef.current = page; }, [page]);

  async function loadFeed(p) {
    setLoading(true);
    setError('');
    try {
      const res = await getFeed(p, LIMIT);
      setFeed(res.data);
      setMeta(res.meta);

      // After the HTTP response is set, ask the socket for any posts that
      // arrived while this component was unmounted (user was on /admin).
      // We do this AFTER setFeed so feed:catchup prepends on top of fresh data.
      if (p === 1 && lastSeenAt) {
        getSocket().emit('sync', { lastSeenAt });
      }

      // Update the high-water mark to the newest post we now know about.
      if (res.data.length > 0) {
        lastSeenAt = res.data[0].created_at;
      }
    } catch {
      setError('Failed to load feed. Is the backend running?');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFeed(page);
  }, [page]);

  // Socket.IO — registered once on mount; refs keep handlers current
  useEffect(() => {
    const socket = getSocket();

    function onConnect() { setConnected(true); }
    function onDisconnect() { setConnected(false); }

    function onFeedNew({ eventId, data }) {
      if (seenEventIds.current.has(eventId)) return;
      seenEventIds.current.add(eventId);
      if (pageRef.current === 1) {
        lastSeenAt = data.created_at; // keep high-water mark in sync
        setFeed((prev) => [data, ...prev]);
        setMeta((prev) => ({ ...prev, total: prev.total + 1 }));
        setNewIds((prev) => new Set(prev).add(data.id));
        setTimeout(() => {
          setNewIds((prev) => {
            const next = new Set(prev);
            next.delete(data.id);
            return next;
          });
        }, 4000);
      }
    }

    function onReconnect() {
      // Actual socket disconnect/reconnect (e.g. backend restart).
      socket.emit('sync', { lastSeenAt: lastSeenAt || new Date(0).toISOString() });
    }

    function onFeedCatchup({ data }) {
      if (!data.length) return;
      // Deduplicate against posts already in the feed (HTTP response may overlap).
      setFeed((prev) => {
        const existingIds = new Set(prev.map((p) => p.id));
        const missed = data.filter((p) => !existingIds.has(p.id));
        if (!missed.length) return prev;
        if (missed[missed.length - 1]?.created_at) {
          lastSeenAt = missed[missed.length - 1].created_at;
        }
        return [...missed.reverse(), ...prev];
      });
      setMeta((prev) => ({ ...prev, total: prev.total + data.length }));
    }

    if (socket.connected) setConnected(true);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('feed:new', onFeedNew);
    socket.on('reconnect', onReconnect);
    socket.on('feed:catchup', onFeedCatchup);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('feed:new', onFeedNew);
      socket.off('reconnect', onReconnect);
      socket.off('feed:catchup', onFeedCatchup);
    };
  }, []);

  const totalPages = Math.ceil(meta.total / LIMIT);

  return (
    <div>
      {/* Header row */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Live Feed</h1>
          {meta.total > 0 && (
            <p className="text-sm text-slate-400 mt-0.5">{meta.total} posts</p>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs font-medium">
          <span
            className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-red-400'}`}
          />
          <span className={connected ? 'text-emerald-600' : 'text-red-500'}>
            {connected ? 'Live' : 'Disconnected'}
          </span>
          {meta.source && (
            <span className="ml-3 bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
              {meta.source}
            </span>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Feed list */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-5 animate-pulse">
              <div className="h-4 bg-slate-200 rounded w-2/3 mb-3" />
              <div className="h-3 bg-slate-100 rounded w-full mb-2" />
              <div className="h-3 bg-slate-100 rounded w-4/5" />
            </div>
          ))}
        </div>
      ) : feed.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <p className="text-4xl mb-3">📋</p>
          <p className="font-medium">No posts yet</p>
          <p className="text-sm mt-1">
            Go to{' '}
            <a href="/admin" className="text-indigo-500 underline">
              Admin
            </a>{' '}
            to create the first post.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {feed.map((post) => (
            <FeedCard key={post.id} post={post} isNew={newIds.has(post.id)} />
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

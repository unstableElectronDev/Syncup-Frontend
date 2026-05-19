const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export async function getFeed(page = 1, limit = 20) {
  const res = await fetch(`${BASE}/api/feed?page=${page}&limit=${limit}`);
  if (!res.ok) throw new Error('Failed to fetch feed');
  return res.json();
}

export async function createPost(token, body) {
  const res = await fetch(`${BASE}/api/feed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function updatePost(token, id, body) {
  const res = await fetch(`${BASE}/api/feed/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function deletePost(token, id) {
  const res = await fetch(`${BASE}/api/feed/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

export async function getDevToken() {
  const res = await fetch(`${BASE}/dev/token`);
  return res.json();
}

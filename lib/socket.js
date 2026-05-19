import { io } from 'socket.io-client';

let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000', {
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });
  }
  return socket;
}

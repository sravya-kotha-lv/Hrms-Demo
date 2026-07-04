import { io, Socket } from "socket.io-client";
import { getToken } from "@/utils/auth";

export type AttendanceUpdatePayload = {
  event?: "CHECK_IN" | "CHECK_OUT";
  attendance?: unknown;
};

type AttendanceHandler = (payload: AttendanceUpdatePayload) => void;

let socketInstance: Socket | null = null;
let connectedToken: string | null = null;

const resolveSocketUrl = () => {
  const configuredUrl = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_BASE_URL || window.location.origin;
  try {
    return new URL(configuredUrl, window.location.origin).origin;
  } catch {
    return window.location.origin;
  }
};

export const getAttendanceSocket = () => {
  const token = getToken();
  if (!token) return null;

  if (!socketInstance || connectedToken !== token) {
    if (socketInstance) {
      socketInstance.disconnect();
    }
    connectedToken = token;
    socketInstance = io(resolveSocketUrl(), {
      path: import.meta.env.VITE_SOCKET_PATH || "/socket.io",
      transports: ["websocket"],
      auth: { token }
    });
  }

  return socketInstance;
};

export const subscribeAttendanceUpdates = (handler: AttendanceHandler) => {
  const socket = getAttendanceSocket();
  if (!socket) return () => undefined;

  const eventName = "attendance:updated";
  socket.on(eventName, handler);

  return () => {
    socket.off(eventName, handler);
  };
};

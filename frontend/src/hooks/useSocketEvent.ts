import { useEffect, useRef } from "react";
import { connectSocket } from "../services/socket";

/**
 * Subscribe to a Socket.IO event for the lifetime of a component.
 * The handler is kept in a ref so callers do not need to memoise it.
 */
export function useSocketEvent<T>(
  event: string,
  handler: (payload: T) => void,
  enabled = true,
) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!enabled) return;
    const socket = connectSocket();
    if (!socket) return;

    const listener = (payload: T) => handlerRef.current(payload);
    socket.on(event, listener);
    return () => {
      socket.off(event, listener);
    };
  }, [event, enabled]);
}

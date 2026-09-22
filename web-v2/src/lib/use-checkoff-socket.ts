"use client";

import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";

let shared: Socket | null = null;

/** Shared Socket.IO connection (path mounted by custom server). */
export function getSocket(): Socket {
  if (!shared) {
    shared = io({ path: "/api/socketio", transports: ["websocket", "polling"] });
  }
  return shared;
}

/** Slave joins a session with its 6-digit code; resolves with the session token. */
export function joinByCode(
  code: string,
): Promise<{ token?: string; state?: SlaveCardState; error?: string }> {
  return new Promise((resolve) => {
    getSocket().emit(
      "slave:join",
      { code },
      (res: { token?: string; state?: SlaveCardState; error?: string }) => {
        resolve(res ?? { error: "NO_RESPONSE" });
      },
    );
  });
}

export type SlaveCardState =
  | { kind: "idle"; experimentNumber: string; experimentName: string }
  | { kind: "ask"; experimentNumber: string }
  | { kind: "question"; studentName: string; index: number; total: number; content: string }
  | { kind: "thanks"; studentName?: string };

/* ---------------- master ---------------- */

interface MasterSnap {
  token: string | null;
  code: string | null;
  slaveConnected: boolean;
  ready: boolean;
}

const EMPTY_MASTER: MasterSnap = { token: null, code: null, slaveConnected: false, ready: false };

export function useMasterSession(masterUserId: string | undefined, enabled: boolean) {
  const socketRef = useRef<Socket | null>(null);
  const stateRef = useRef<MasterSnap>({ ...EMPTY_MASTER });
  const listenersRef = useRef(new Set<() => void>());

  const notify = () => listenersRef.current.forEach((fn) => fn());

  useEffect(() => {
    if (!enabled || !masterUserId) return;
    const socket = getSocket();
    socketRef.current = socket;

    const onSlaveJoined = () => {
      stateRef.current = { ...stateRef.current, slaveConnected: true };
      notify();
    };
    socket.on("master:slave-joined", onSlaveJoined);

    socket.emit("master:create", { masterUserId }, (res: { token?: string; code?: string; error?: string }) => {
      if (res?.token) {
        stateRef.current = { token: res.token, code: res.code ?? null, slaveConnected: false, ready: true };
        notify();
      }
    });

    return () => {
      if (stateRef.current.token) {
        socket.emit("master:close", { token: stateRef.current.token });
      }
      socket.off("master:slave-joined", onSlaveJoined);
      stateRef.current = { ...EMPTY_MASTER };
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, masterUserId]);

  const subscribe = useRef((fn: () => void) => {
    listenersRef.current.add(fn);
    return () => {
      listenersRef.current.delete(fn);
    };
  }).current;

  const cachedRef = useRef<MasterSnap>(stateRef.current);
  const getSnapshot = useRef((): MasterSnap => {
    const s = stateRef.current;
    const c = cachedRef.current;
    if (
      s.token !== c.token ||
      s.code !== c.code ||
      s.slaveConnected !== c.slaveConnected ||
      s.ready !== c.ready
    ) {
      cachedRef.current = { ...s };
    }
    return cachedRef.current;
  }).current;

  const getServerSnapshot = useRef((): MasterSnap => EMPTY_MASTER).current;

  const pushState = (state: SlaveCardState, experimentId?: string | null) => {
    const token = stateRef.current.token;
    if (!token || !socketRef.current) return;
    socketRef.current.emit("master:state", { token, state, experimentId: experimentId ?? undefined });
  };

  return { subscribe, getSnapshot, getServerSnapshot, pushState };
}


/* ---------------- slave ---------------- */

interface SlaveSnap {
  state: SlaveCardState | null;
  closed: boolean;
  connected: boolean;
  error: string | null;
}

const EMPTY_SLAVE: SlaveSnap = { state: null, closed: false, connected: false, error: null };

export function useSlaveSession(joinToken: string | null) {
  const stateRef = useRef<SlaveSnap>({ ...EMPTY_SLAVE });
  const listenersRef = useRef(new Set<() => void>());

  const notify = () => listenersRef.current.forEach((fn) => fn());

  useEffect(() => {
    if (!joinToken) return;
    const socket = getSocket();

    const onState = ({ state }: { state: SlaveCardState }) => {
      stateRef.current = { ...stateRef.current, state };
      notify();
    };
    const onClosed = () => {
      stateRef.current = { ...stateRef.current, closed: true };
      notify();
    };

    socket.on("slave:state", onState);
    socket.on("slave:closed", onClosed);

    socket.emit("slave:join", { token: joinToken }, (res: { token?: string; state?: SlaveCardState; error?: string }) => {
      stateRef.current = {
        ...stateRef.current,
        connected: true,
        ...(res?.state ? { state: res.state } : {}),
        error: res?.error ?? null,
      };
      notify();
    });

    return () => {
      socket.off("slave:state", onState);
      socket.off("slave:closed", onClosed);
    };
  }, [joinToken]);

  const subscribe = useRef((fn: () => void) => {
    listenersRef.current.add(fn);
    return () => {
      listenersRef.current.delete(fn);
    };
  }).current;

  const cachedRef = useRef<SlaveSnap>(stateRef.current);
  const getSnapshot = useRef((): SlaveSnap => {
    const s = stateRef.current;
    const c = cachedRef.current;
    if (
      s.state !== c.state ||
      s.closed !== c.closed ||
      s.connected !== c.connected ||
      s.error !== c.error
    ) {
      cachedRef.current = { ...s };
    }
    return cachedRef.current;
  }).current;

  const getServerSnapshot = useRef((): SlaveSnap => EMPTY_SLAVE).current;

  return { subscribe, getSnapshot, getServerSnapshot };
}

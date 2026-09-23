/**
 * Custom Node server: Next.js + Socket.IO for multi-device checkoff.
 * Production & dev entry: `node server.js`
 */
const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { Server } = require("socket.io");
const crypto = require("crypto");

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOST ?? "0.0.0.0";
const port = parseInt(process.env.PORT ?? "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

/* ------------------------------------------------- */
/* In-memory checkoff sessions (shared via globalThis */
/* so Next route handlers can read them too).         */
/* ------------------------------------------------- */
const TTL = 1000 * 60 * 60 * 4;
const globalStore = globalThis;
globalStore.__checkoffSessions ??= new Map();
const sessions = globalStore.__checkoffSessions;

function gc() {
  const now = Date.now();
  for (const [k, s] of sessions) {
    if (now - s.updatedAt > TTL) sessions.delete(k);
  }
}

function createSession(masterUserId) {
  gc();
  const session = {
    token: crypto.randomBytes(24).toString("base64url"),
    code: String(crypto.randomInt(0, 1_000_000)).padStart(6, "0"),
    masterUserId,
    experimentId: null,
    state: { kind: "idle", experimentNumber: "—", experimentName: "" },
    studentInput: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  sessions.set(session.token, session);
  return session;
}

function getSessionByCode(code) {
  gc();
  for (const s of sessions.values()) if (s.code === code) return s;
  return null;
}

app.prepare().then(() => {
  const server = createServer((req, res) => {
    handle(req, res, parse(req.url, true));
  });

  const io = new Server(server, {
    path: "/api/socketio",
    cors: { origin: true, credentials: true },
  });

  io.on("connection", (socket) => {
    /* ---------- master: create/attach a session ---------- */
    socket.on("master:create", ({ masterUserId }, ack) => {
      if (!masterUserId) return ack?.({ error: "BAD_REQUEST" });
      const session = createSession(masterUserId);
      socket.data.sessionToken = session.token;
      socket.data.role = "master";
      socket.data.masterUserId = masterUserId;
      socket.join(`session:${session.token}`);
      ack?.({ token: session.token, code: session.code, state: session.state });
    });

    socket.on("master:attach", ({ token, masterUserId }, ack) => {
      const s = sessions.get(token);
      if (!s || s.masterUserId !== masterUserId) return ack?.({ error: "FORBIDDEN" });
      socket.data.sessionToken = token;
      socket.data.role = "master";
      socket.data.masterUserId = masterUserId;
      socket.join(`session:${token}`);
      ack?.({ token, code: s.code, state: s.state, studentInput: s.studentInput });
    });

    /* ---------- master: push state to slaves ---------- */
    socket.on("master:state", ({ token, state, experimentId }) => {
      if (socket.data.role !== "master") return;
      const s = sessions.get(token);
      if (!s || s.masterUserId !== socket.data.masterUserId) return;
      if (state) s.state = state;
      if (experimentId !== undefined) s.experimentId = experimentId;
      s.studentInput = null;
      s.updatedAt = Date.now();
      io.to(`session:${token}`).emit("slave:state", { state: s.state });
    });

    /* ---------- slave: join via 6-digit code or token ---------- */
    socket.on("slave:join", ({ token, code }, ack) => {
      const s = token ? sessions.get(token) : getSessionByCode(code);
      if (!s) return ack?.({ error: "SESSION_NOT_FOUND" });
      socket.data.sessionToken = s.token;
      socket.data.role = "slave";
      socket.join(`session:${s.token}`);
      ack?.({ token: s.token, state: s.state });
      io.to(`session:${s.token}`).emit("master:slave-joined");
    });

    socket.on("master:close", ({ token }) => {
      if (socket.data.role !== "master") return;
      sessions.delete(token);
      io.to(`session:${token}`).emit("slave:closed");
      io.socketsLeave(`session:${token}`);
    });
  });

  server.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> Socket.IO on /api/socketio`);
  });
});

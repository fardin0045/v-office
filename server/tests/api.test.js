/**
 * End-to-end API + realtime tests.
 *
 * Starts a real server on TEST_PORT against a throwaway database (TEST_MONGO_URI, default
 * mongodb://127.0.0.1:27017/voffice_test), seeds it with the demo data, runs the suite and drops the
 * database afterwards. Requires a reachable MongoDB.
 *
 *   npm test            (from server/)
 */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
const path = require('node:path');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { io } = require('socket.io-client');

const PORT = Number(process.env.TEST_PORT) || 5099;
const MONGO_URI =
  process.env.TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/voffice_test';
const BASE = `http://127.0.0.1:${PORT}`;
// The suite seeds (wipes) and finally drops this database, so refuse anything that isn't clearly a test DB.
const DB_NAME = new URL(
  MONGO_URI.replace(/^mongodb(\+srv)?:/, 'http:'),
).pathname.slice(1);
if (!/test/i.test(DB_NAME)) {
  throw new Error(
    `Refusing to run: TEST_MONGO_URI must point at a database whose name contains "test" (got "${DB_NAME}").`,
  );
}
const ROOT = path.resolve(__dirname, '..');
const ENV = {
  ...process.env,
  NODE_ENV: 'test',
  PORT: String(PORT),
  MONGO_URI,
  JWT_SECRET: 'test-secret-that-is-long-enough-for-hs256-signing',
  PRESENCE_GRACE_SECONDS: '1',
  AUTO_START_MONGO: 'false',
  SERVE_CLIENT: 'false',
  AUTH_RATE_LIMIT: '1000',
  // Fast automatic check-out so the presence test finishes quickly: 3 s offline, swept every second.
  AUTO_CHECKOUT_AFTER_MINUTES: '0.05',
  SESSION_SWEEP_SECONDS: '1',
};

let server;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(method, route, token, body) {
  const res = await fetch(`${BASE}/api${route}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}
const login = async (email, password) =>
  (await api('POST', '/auth/login', null, { email, password })).data;
const connect = () =>
  new Promise((resolve) => {
    const socket = io(BASE, { transports: ['websocket'], reconnection: false });
    socket.on('connect', () => resolve(socket));
  });
const events = (socket) => {
  const list = [];
  socket.onAny((name, payload) => list.push({ name, payload }));
  return list;
};

before(async () => {
  const seeded = spawnSync(process.execPath, ['src/seed/seedData.js'], {
    cwd: ROOT,
    env: ENV,
    encoding: 'utf8',
  });
  if (seeded.status !== 0)
    throw new Error(`Seeding failed:\n${seeded.stdout}\n${seeded.stderr}`);

  server = spawn(process.execPath, ['src/server.js'], {
    cwd: ROOT,
    env: ENV,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  server.stdout.on('data', (d) => (output += d));
  server.stderr.on('data', (d) => (output += d));
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`${BASE}/api/health`)).ok) return;
    } catch {
      /* not up yet */
    }
    await sleep(250);
  }
  throw new Error(`Server did not start:\n${output}`);
});

after(async () => {
  server?.kill();
  await mongoose.connect(MONGO_URI);
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

// ---------------------------------------------------------------- authentication

test('login rejects bad credentials the same way for unknown and known emails', async () => {
  const unknown = await api('POST', '/auth/login', null, {
    email: 'nobody@voffice.local',
    password: 'Whatever123!',
  });
  const wrong = await api('POST', '/auth/login', null, {
    email: 'maya.p@voffice.local',
    password: 'Wrong123!',
  });
  assert.equal(unknown.status, 401);
  assert.equal(wrong.status, 401);
  assert.equal(unknown.data.message, wrong.data.message);
});

test('protected routes reject missing, forged and unsigned tokens', async () => {
  assert.equal((await api('GET', '/auth/me')).status, 401);
  const maya = await login('maya.p@voffice.local', 'Employee123!');
  const forged = jwt.sign({ id: maya._id }, 'not-the-server-secret');
  assert.equal((await api('GET', '/auth/me', forged)).status, 401);
  const unsigned = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify({ id: maya._id })).toString('base64url')}.`;
  assert.equal((await api('GET', '/auth/me', unsigned)).status, 401);
});

test('login responses never include the password hash', async () => {
  const maya = await login('maya.p@voffice.local', 'Employee123!');
  assert.ok(maya.token);
  assert.equal(maya.password, undefined);
  const me = await api('GET', '/auth/me', maya.token);
  assert.equal(me.data.password, undefined);
  assert.equal(me.data.passwordChangedAt, undefined);
});

test('registration validates input and always creates an employee', async () => {
  const tooLong = await api('POST', '/auth/register', null, {
    name: 'X',
    email: 'x@y.io',
    employeeId: 'EMP-900',
    password: 'a'.repeat(129),
  });
  assert.equal(tooLong.status, 400);
  const res = await api('POST', '/auth/register', null, {
    name: 'New Person',
    email: 'new.person@voffice.local',
    employeeId: 'EMP-901',
    password: 'Password123!',
    role: 'admin',
  });
  assert.equal(res.status, 201);
  assert.equal(res.data.role, 'employee');
});

test('changing the password needs the current one and revokes older tokens', async () => {
  const first = await login('elena.r@voffice.local', 'Employee123!');
  const second = await login('elena.r@voffice.local', 'Employee123!');

  const noCurrent = await api('PUT', '/auth/profile', first.token, {
    password: 'BrandNew123!',
  });
  assert.equal(noCurrent.status, 400);
  const wrongCurrent = await api('PUT', '/auth/profile', first.token, {
    password: 'BrandNew123!',
    currentPassword: 'nope',
  });
  assert.equal(wrongCurrent.status, 400);

  await sleep(1100); // tokens carry second-precision issue times
  const changed = await api('PUT', '/auth/profile', first.token, {
    password: 'BrandNew123!',
    currentPassword: 'Employee123!',
  });
  assert.equal(changed.status, 200);
  assert.equal(
    (await api('GET', '/auth/me', changed.data.token)).status,
    200,
    'fresh token keeps working',
  );
  assert.equal(
    (await api('GET', '/auth/me', second.token)).status,
    401,
    'other devices are signed out',
  );
  assert.equal(
    (await login('elena.r@voffice.local', 'BrandNew123!')).name,
    'Elena Rostova',
  );
});

// ---------------------------------------------------------------- realtime privacy

test('anonymous viewers see desks but no private realtime events', async () => {
  const anon = await connect();
  const seen = events(anon);
  const james = await login('james.w@voffice.local', 'Employee123!');
  await api('POST', '/work/end', james.token); // may or may not have a seeded session
  const start = await api('POST', '/work/start', james.token, {
    mode: 'office',
    deskId: james.assignedDesk,
  });
  assert.equal(start.status, 201);
  await api('POST', '/chat/messages', james.token, { text: 'hello' });
  await sleep(400);
  assert.ok(
    seen.some((e) => e.name === 'desk:update'),
    'desk changes are public',
  );
  assert.ok(
    !seen.some((e) => e.name === 'employee:status_change'),
    'no check-in details',
  );
  assert.ok(
    !seen.some(
      (e) => e.name.startsWith('chat:') || e.name.startsWith('meeting:'),
    ),
    'no chat or meetings',
  );
  anon.disconnect();
  await api('POST', '/work/end', james.token);
});

test('forged socket identities are refused and deleted users lose realtime access at once', async () => {
  const admin = await login('admin@voffice.local', 'Admin123!');
  const created = await api('POST', '/employees', admin.token, {
    name: 'Temp Person',
    email: 'temp.person@voffice.local',
    employeeId: 'EMP-950',
    password: 'Password123!',
  });
  assert.equal(created.status, 201);
  const temp = await login('temp.person@voffice.local', 'Password123!');

  const forgedSocket = await connect();
  const forgedSeen = events(forgedSocket);
  forgedSocket.emit(
    'presence:identify',
    jwt.sign({ id: temp._id }, 'wrong-secret'),
  );

  const socket = await connect();
  const seen = events(socket);
  socket.emit('presence:identify', temp.token);
  await sleep(400);
  assert.ok(forgedSeen.some((e) => e.name === 'presence:rejected'));

  await api('POST', '/chat/messages', admin.token, { text: 'before removal' });
  await sleep(300);
  assert.ok(
    seen.some((e) => e.name === 'chat:message'),
    'signed-in socket receives chat',
  );

  assert.equal(
    (await api('DELETE', `/employees/${temp._id}`, admin.token)).status,
    200,
  );
  await sleep(300);
  assert.ok(
    seen.some((e) => e.name === 'presence:rejected'),
    'socket told to re-authenticate',
  );
  const before = seen.filter((e) => e.name === 'chat:message').length;
  await api('POST', '/chat/messages', admin.token, { text: 'after removal' });
  await sleep(300);
  assert.equal(
    seen.filter((e) => e.name === 'chat:message').length,
    before,
    'no more private data',
  );
  assert.equal((await api('GET', '/auth/me', temp.token)).status, 401);
  socket.disconnect();
  forgedSocket.disconnect();
});

// ---------------------------------------------------------------- work sessions

test('employees can only check in at their own desk in the office', async () => {
  const maya = await login('maya.p@voffice.local', 'Employee123!');
  await api('POST', '/work/end', maya.token);
  const other = await api('POST', '/work/start', maya.token, {
    mode: 'office',
    deskId: 'DESK-01',
  });
  assert.equal(other.status, 403);
});

test('ending a session twice at the same moment succeeds exactly once', async () => {
  const maya = await login('maya.p@voffice.local', 'Employee123!');
  await api('POST', '/work/end', maya.token);
  assert.equal(
    (
      await api('POST', '/work/start', maya.token, {
        mode: 'office',
        deskId: 'DESK-03',
      })
    ).status,
    201,
  );
  const results = await Promise.all([
    api('POST', '/work/end', maya.token),
    api('POST', '/work/end', maya.token),
  ]);
  const statuses = results.map((r) => r.status).sort();
  assert.equal(statuses[0], 200);
  assert.ok([404, 409].includes(statuses[1]), `second call was ${statuses[1]}`);
  const desk = (await api('GET', '/desks/DESK-03')).data;
  assert.equal(desk.currentSessionId, null);
  assert.equal(desk.status, 'available');
});

test('creating an employee with an unknown desk leaves no half-created account', async () => {
  const admin = await login('admin@voffice.local', 'Admin123!');
  const res = await api('POST', '/employees', admin.token, {
    name: 'Ghost',
    email: 'ghost@voffice.local',
    employeeId: 'EMP-960',
    password: 'Password123!',
    assignedDesk: 'DESK-999',
  });
  assert.equal(res.status, 404);
  assert.equal(
    (await login('ghost@voffice.local', 'Password123!')).token,
    undefined,
  );
});

test('the monthly activity report lists every day and is admin-only', async () => {
  const admin = await login('admin@voffice.local', 'Admin123!');
  const maya = await login('maya.p@voffice.local', 'Employee123!');
  assert.equal(
    (await api('GET', `/employees/${maya._id}/activity`, maya.token)).status,
    403,
  );
  const report = await api(
    'GET',
    `/employees/${maya._id}/activity?month=2028-02`,
    admin.token,
  );
  assert.equal(report.status, 200);
  assert.equal(report.data.days.length, 29);
});

// ---------------------------------------------------------------- chat, meetings, notifications

test('team chat: permissions, unread counts and flood protection', async () => {
  const admin = await login('admin@voffice.local', 'Admin123!');
  const james = await login('james.w@voffice.local', 'Employee123!');
  assert.equal(
    (
      await api('POST', '/chat/messages', james.token, {
        kind: 'announcement',
        text: 'x',
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await api('POST', '/chat/messages', james.token, {
        kind: 'absence',
        text: 'Sick',
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await api('POST', '/chat/messages', admin.token, {
        kind: 'announcement',
        text: 'Team lunch Friday',
      })
    ).status,
    201,
  );
  await api('POST', '/chat/read', james.token);
  await api('POST', '/chat/messages', admin.token, { text: 'Reminder' });
  assert.equal((await api('GET', '/chat/unread', james.token)).data.count, 1);

  let limited = 0;
  for (let i = 0; i < 12; i++)
    if (
      (await api('POST', '/chat/messages', james.token, { text: `m${i}` }))
        .status === 429
    )
      limited++;
  assert.ok(limited > 0, 'rapid posting is throttled');
});

test('meetings: admin-only scheduling, no double booking, everyone notified', async () => {
  const admin = await login('admin@voffice.local', 'Admin123!');
  const maya = await login('maya.p@voffice.local', 'Employee123!');
  const startsAt = new Date(Date.now() + 3 * 3600e3).toISOString();
  assert.equal(
    (
      await api('POST', '/meetings', maya.token, {
        title: 'Nope',
        startsAt,
        durationMinutes: 30,
      })
    ).status,
    403,
  );
  const created = await api('POST', '/meetings', admin.token, {
    title: 'Planning',
    startsAt,
    durationMinutes: 60,
  });
  assert.equal(created.status, 201);
  assert.match(created.data.link, /^https:\/\//);
  const clash = await api('POST', '/meetings', admin.token, {
    title: 'Clash',
    startsAt,
    durationMinutes: 30,
  });
  assert.equal(clash.status, 409);
  const bad = await api('POST', '/meetings', admin.token, {
    title: 'Bad link',
    startsAt: new Date(Date.now() + 9 * 3600e3).toISOString(),
    durationMinutes: 30,
    link: 'javascript:alert(1)',
  });
  assert.equal(bad.status, 400);
  const feed = (await api('GET', '/notifications', maya.token)).data;
  assert.ok(
    feed.items.some((i) => i.kind === 'meeting' && i.title === 'Planning'),
  );
});

test('API input is validated (ids, pagination, unknown routes)', async () => {
  const admin = await login('admin@voffice.local', 'Admin123!');
  assert.equal(
    (await api('GET', '/employees/not-an-id', admin.token)).status,
    400,
  );
  assert.equal(
    (await api('DELETE', '/chat/messages/not-an-id', admin.token)).status,
    400,
  );
  const page = await api('GET', '/admin/sessions?limit=100000', admin.token);
  assert.ok(page.data.sessions.length <= 100);
  assert.equal((await api('GET', '/does-not-exist')).status, 404);
  const injection = await api('POST', '/auth/login', null, {
    email: { $gt: '' },
    password: { $gt: '' },
  });
  assert.equal(injection.status, 400);
});

// ---------------------------------------------------------------- presence & automatic check-out

test('staying online keeps a session; closing the app checks out automatically at the time you left', async () => {
  const james = await login('james.w@voffice.local', 'Employee123!');
  await api('POST', '/work/end', james.token);

  const socket = await connect();
  socket.emit('presence:identify', james.token);
  await sleep(300);
  assert.equal(
    (
      await api('POST', '/work/start', james.token, {
        mode: 'office',
        deskId: james.assignedDesk,
      })
    ).status,
    201,
  );

  await sleep(5000); // longer than the 3 s offline limit, but the tab is open
  assert.ok(
    (await api('GET', '/work/active', james.token)).data.activeSession,
    'online session stays open',
  );

  const leftAt = Date.now();
  socket.disconnect();
  await sleep(1000 + 3000 + 2500); // grace + offline limit + sweep
  const active = (await api('GET', '/work/active', james.token)).data
    .activeSession;
  assert.equal(active, null, 'session closed after leaving');

  const history = (await api('GET', '/work/history?limit=1', james.token)).data
    .sessions[0];
  assert.equal(history.endReason, 'auto-offline');
  assert.ok(
    Math.abs(new Date(history.checkOut).getTime() - leftAt) < 2500,
    'check-out recorded when they left',
  );
});

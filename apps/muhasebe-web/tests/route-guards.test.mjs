import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";

import { resetTestState, setCookieEntries, setPrismaMock } from "./runtime/mock-state.mjs";

const futureDate = new Date("2099-01-01T00:00:00.000Z");

beforeEach(() => {
  resetTestState();
});

async function importAppModule(relativePath) {
  const url = new URL(`../${relativePath}?t=${Date.now()}-${Math.random()}`, import.meta.url);
  return import(url);
}

async function createSessionRecord(roles) {
  const [{ hashSessionToken, SESSION_COOKIE }] = await Promise.all([
    importAppModule("lib/auth/session.ts"),
  ]);

  const token = "test-session-token";
  setCookieEntries({ [SESSION_COOKIE]: token });

  return {
    sessionCookie: SESSION_COOKIE,
    sessionRecord: {
      expiresAt: futureDate,
      id: "session-1",
      lastSeenAt: new Date("2098-12-31T23:59:00.000Z"),
      user: {
        id: "user-1",
        isActive: true,
        roles: roles.map((key) => ({ role: { key } })),
        username: "demo",
      },
    },
    tokenHash: hashSessionToken(token),
  };
}

test("forged cookie cannot access protected master routes", async () => {
  const [{ GET }, { SESSION_COOKIE }] = await Promise.all([
    importAppModule("app/api/master/[entity]/route.ts"),
    importAppModule("lib/auth/session.ts"),
  ]);

  setCookieEntries({ [SESSION_COOKIE]: "forged-cookie" });
  setPrismaMock({
    session: {
      findUnique: async () => null,
    },
  });

  const response = await GET(new Request("http://test.local/api/master/items?page=1"), {
    params: Promise.resolve({ entity: "items" }),
  });

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "Oturum acmaniz gerekiyor" });
});

test("settings users route returns 403 for authenticated non-admin users", async () => {
  const [{ GET }, { deleted }] = await Promise.all([
    importAppModule("app/api/settings/users/route.ts"),
    import("./runtime/mock-state.mjs").then((module) => module.getCookieStore()),
  ]);
  const { tokenHash, sessionRecord } = await createSessionRecord(["ACCOUNTANT"]);

  setPrismaMock({
    session: {
      findUnique: async ({ where }) =>
        where.tokenHash === tokenHash ? sessionRecord : null,
      update: async () => undefined,
    },
  });

  const response = await GET();

  assert.equal(response.status, 403);
  assert.match((await response.json()).error, /yetki|permission/i);
  assert.deepEqual(deleted, []);
});

test("settings users route returns 400 for invalid payloads", async () => {
  const [{ POST }] = await Promise.all([
    importAppModule("app/api/settings/users/route.ts"),
  ]);
  const { tokenHash, sessionRecord } = await createSessionRecord(["ADMIN"]);

  setPrismaMock({
    session: {
      findUnique: async ({ where }) =>
        where.tokenHash === tokenHash ? sessionRecord : null,
      update: async () => undefined,
    },
  });

  const response = await POST(
    new Request("http://test.local/api/settings/users", {
      body: JSON.stringify({
        displayName: "",
        isActive: "yes",
        password: "",
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    }),
  );

  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /zorunlu|boolean/i);
});

test("period lock route returns 403 for authenticated non-admin users", async () => {
  const [{ GET }] = await Promise.all([
    importAppModule("app/api/settings/period-lock/route.ts"),
  ]);
  const { tokenHash, sessionRecord } = await createSessionRecord(["ACCOUNTANT"]);

  setPrismaMock({
    session: {
      findUnique: async ({ where }) =>
        where.tokenHash === tokenHash ? sessionRecord : null,
      update: async () => undefined,
    },
  });

  const response = await GET();

  assert.equal(response.status, 403);
  assert.match((await response.json()).error, /yetki|yonetici/i);
});

test("master archive route returns 403 for authenticated non-admin users", async () => {
  const [{ DELETE: deleteRoute }] = await Promise.all([
    importAppModule("app/api/master/[entity]/[id]/route.ts"),
  ]);
  const { tokenHash, sessionRecord } = await createSessionRecord(["ACCOUNTANT"]);

  setPrismaMock({
    session: {
      findUnique: async ({ where }) =>
        where.tokenHash === tokenHash ? sessionRecord : null,
      update: async () => undefined,
    },
  });

  const response = await deleteRoute(
    new Request("http://test.local/api/master/items/item-1", { method: "DELETE" }),
    { params: Promise.resolve({ entity: "items", id: "item-1" }) },
  );

  assert.equal(response.status, 403);
  assert.match((await response.json()).error, /yonetici|pasife alma/i);
});

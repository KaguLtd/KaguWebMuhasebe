import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { resetTestState, setPrismaMock } from "./runtime/mock-state.mjs";

beforeEach(() => {
  resetTestState();
});

async function importAppModule(relativePath) {
  const url = new URL(`../${relativePath}?t=${Date.now()}-${Math.random()}`, import.meta.url);
  return import(url);
}

test("login auth source wires lockout storage with 5 failures over 15 minutes", async () => {
  const [authSource, lockoutSource] = await Promise.all([
    readFile(new URL("../lib/auth/server.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/auth/lockout.ts", import.meta.url), "utf8"),
  ]);

  assert.match(authSource, /assertLoginAllowed|recordLoginFailure|clearLoginFailures/);
  assert.match(lockoutSource, /lockedUntil|failureCount/);
  assert.match(lockoutSource, /15\s*\*\s*60|900_?000|minutes?\s*[:=]\s*15/i);
  assert.match(lockoutSource, /MAX_LOGIN_FAILURES\s*=\s*5|failureCount\s*>?=\s*5/);
});

test("updateUser blocks removing or deactivating the last active admin", async () => {
  const { updateUser } = await importAppModule("lib/admin/user-repository.ts");
  let updateCalled = 0;

  setPrismaMock({
    role: {
      findMany: async () => [{ id: "role-accountant", key: "ACCOUNTANT" }],
    },
    user: {
      count: async () => 1,
      findUnique: async ({ where }) => {
        if (where.id === "user-1") {
          return {
            displayName: "Admin User",
            email: "admin@test.local",
            id: "user-1",
            isActive: true,
            passwordHash: "scrypt$salt$hash",
            roles: [{ role: { key: "ADMIN" }, roleId: "role-admin" }],
            sessions: [],
            username: "admin",
          };
        }

        return null;
      },
      update: async () => {
        updateCalled += 1;
        return {
          displayName: "Admin User",
          email: "admin@test.local",
          id: "user-1",
          isActive: false,
          passwordHash: "scrypt$salt$hash",
          roles: [{ role: { key: "ACCOUNTANT" }, roleId: "role-accountant" }],
          sessions: [],
          username: "admin",
        };
      },
    },
  });

  await assert.rejects(
    updateUser("user-1", {
      isActive: false,
      roleIds: ["role-accountant"],
    }),
  );
  assert.equal(updateCalled, 0);
});

test("audit writes require actorUserId in document and master repositories", async () => {
  const [documentSource, masterSource] = await Promise.all([
    readFile(new URL("../lib/kagu/document-repository.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/kagu/master-repository.ts", import.meta.url), "utf8"),
  ]);

  assert.match(documentSource, /actorUserId/);
  assert.match(masterSource, /actorUserId/);
});

test("document repository keeps history through supersede flow and period lock checks", async () => {
  const source = await readFile(
    new URL("../lib/kagu/document-repository.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /SUPERSEDED/);
  assert.match(source, /deactivateDocumentEffects/);
  assert.match(source, /assertPeriodLockAllows/);
  assert.match(source, /CREATE_REVISION_DRAFT|SUPERSEDE/);
});

test("seed-dev script refuses production-like environments before seeding", async () => {
  const source = await readFile(
    new URL("../scripts/seed-dev.mjs", import.meta.url),
    "utf8",
  );

  assert.match(source, /assertSafeDevSeedEnvironment\(\)/);
  assert.match(source, /NODE_ENV=production|NODE_ENV.*production/);
  assert.match(source, /--production/);
  assert.match(source, /non-local database host|DATABASE_URL/i);
});

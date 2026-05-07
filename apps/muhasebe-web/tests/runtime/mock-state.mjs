const defaultCookieStore = () => {
  const values = new Map();
  const deleted = [];
  const writes = [];

  return {
    deleted,
    get(name) {
      const value = values.get(name);
      return value == null ? undefined : { name, value };
    },
    seed(entries) {
      values.clear();
      deleted.length = 0;
      writes.length = 0;

      for (const [name, value] of Object.entries(entries)) {
        values.set(name, value);
      }
    },
    set(name, value, options) {
      values.set(name, value);
      writes.push({ name, options, value });
    },
    delete(name) {
      values.delete(name);
      deleted.push(name);
    },
    snapshot() {
      return Object.fromEntries(values.entries());
    },
    writes,
  };
};

const state = globalThis.__muhasebeWebTestState ??= {
  cookieStore: defaultCookieStore(),
  prisma: {},
};

function createThrowingFunction(path) {
  return () => {
    throw new Error(`Missing prisma mock for ${path}`);
  };
}

function createThrowingProxy(path) {
  return new Proxy(createThrowingFunction(path), {
    apply(target, thisArg, args) {
      return Reflect.apply(target, thisArg, args);
    },
    get(_target, prop) {
      if (prop === Symbol.toStringTag) {
        return "Function";
      }

      return createThrowingProxy(`${path}.${String(prop)}`);
    },
  });
}

function clonePrismaValue(value) {
  if (Array.isArray(value)) {
    return value.map(clonePrismaValue);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, inner]) => [key, clonePrismaValue(inner)]),
    );
  }

  return value;
}

export function resetTestState() {
  state.cookieStore = defaultCookieStore();
  state.prisma = {};
}

export function setCookieEntries(entries) {
  state.cookieStore.seed(entries);
  return state.cookieStore;
}

export function getCookieStore() {
  return state.cookieStore;
}

export function setPrismaMock(mock) {
  state.prisma = clonePrismaValue(mock);
}

export function mergePrismaMock(patch) {
  state.prisma = {
    ...state.prisma,
    ...clonePrismaValue(patch),
  };
}

export function getPrismaMock() {
  return state.prisma;
}

export function createPrismaProxy(path = "prisma") {
  return new Proxy(
    {},
    {
      get(_target, prop) {
        const value = state.prisma[prop];

        if (value === undefined) {
          return createThrowingProxy(`${path}.${String(prop)}`);
        }

        return value;
      },
    },
  );
}

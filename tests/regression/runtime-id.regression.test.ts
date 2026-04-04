import assert from "node:assert/strict";
import test from "node:test";

import { createRuntimeId } from "@/src/utils/runtime-id";

test("runtime id: usa fallback estable cuando randomUUID no existe", () => {
  const originalCrypto = globalThis.crypto;

  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    value: {
      getRandomValues(buffer: Uint8Array) {
        for (let index = 0; index < buffer.length; index += 1) {
          buffer[index] = index + 1;
        }

        return buffer;
      },
    },
  });

  const id = createRuntimeId();

  assert.match(
    id,
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );

  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    value: originalCrypto,
  });
});

test("runtime id: cae a prefijo temporal sin crypto", () => {
  const originalCrypto = globalThis.crypto;

  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    value: undefined,
  });

  const id = createRuntimeId("quote");

  assert.match(id, /^quote-/);

  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    value: originalCrypto,
  });
});
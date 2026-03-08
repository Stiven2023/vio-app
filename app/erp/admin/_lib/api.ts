export async function apiJson<T>(
  input: RequestInfo,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    credentials: "include",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");

    throw new Error(text || `Error ${res.status}`);
  }

  return (await res.json()) as T;
}

export function getErrorMessage(err: unknown) {
  return err instanceof Error ? err.message : "Error inesperado";
}

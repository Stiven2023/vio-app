export async function apiJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    credentials: "include",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");

    throw new Error(text || `HTTP ${res.status}`);
  }

  return (await res.json()) as T;
}

export function getErrorMessage(err: unknown) {
  if (err instanceof Error) return err.message;

  return "Ocurrió un error";
}

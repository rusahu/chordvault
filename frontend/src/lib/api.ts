export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function api<T = unknown>(
  method: string,
  path: string,
  body?: unknown,
  token?: string | null
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data: Record<string, unknown>;
  try {
    data = await res.json();
  } catch {
    if (!res.ok) throw new ApiError(`Server error (${res.status})`, res.status);
    throw new ApiError('Invalid response from server', res.status);
  }
  if (!res.ok) throw new ApiError((data.error as string) || 'Request failed', res.status);
  return data as T;
}

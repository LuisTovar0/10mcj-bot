export async function fetchChecked(url: string | URL, operation: string, options?: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url, options);
  } catch {
    // Bun's fetch errors can contain the full URL, including API credentials.
    throw new Error(`${ operation } request failed.`);
  }
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`${ operation } failed with HTTP ${ response.status }.`);
  }
  return response;
}

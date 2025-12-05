export interface TokenAnalysis {
  raw: string;
  siteId?: string;
  url?: string;
  potentialSecrets: string[];
}

export async function fetchWebsiteData(rawPubToken: string): Promise<any> {
  try {
    const normalized = rawPubToken.trim();
    const analysis = analyzePubToken(normalized);

    const endpointCandidates = buildEndpointCandidates(analysis);
    const authCandidates = buildAuthHeaderCandidates(analysis);

    for (const endpoint of endpointCandidates) {
      for (const authHeader of authCandidates) {
        try {
          const response = await fetch(endpoint, {
            headers: {
              Authorization: authHeader,
            },
          });

          if (response.ok) {
            return response.json();
          }

          if (response.status !== 401) {
            const errorText = await response.text();
            throw new Error(
              `Failed to fetch website data: ${response.status} ${response.statusText} - ${errorText}`
            );
          }
        } catch {
          continue;
        }
      }
    }

    throw new Error(
      'Unable to fetch SleekCMS data. Please verify your pub token.'
    );
  } catch (error: any) {
    throw new Error(`Error fetching website data: ${error.message}`);
  }
}

export function analyzePubToken(token: string): TokenAnalysis {
  const result: TokenAnalysis = {
    raw: token,
    potentialSecrets: [],
  };

  const pubMatch = token.match(/^pub-([^-]+)-(.*)$/);
  if (pubMatch) {
    result.siteId = pubMatch[1];
    result.potentialSecrets.push(pubMatch[2]);
  }

  if (token.startsWith('http')) {
    try {
      const url = new URL(token);
      const segments = url.pathname.split('/').filter(Boolean);
      if (!result.siteId && segments.length > 0) {
        result.siteId = segments[0];
      }
      if (segments.length > 1) {
        result.potentialSecrets.push(segments[segments.length - 1]);
      }
      result.url = token;
    } catch {}
  }

  if (!token.startsWith('http') && token.includes('/')) {
    const segments = token.split('/').filter(Boolean);
    if (!result.siteId && segments.length > 0) {
      result.siteId = segments[0];
    }
    if (segments.length > 1) {
      result.potentialSecrets.push(segments[segments.length - 1]);
    }
  }

  result.potentialSecrets.push(token);
  result.potentialSecrets = Array.from(new Set(result.potentialSecrets.filter(Boolean)));

  return result;
}

export function buildEndpointCandidates(analysis: TokenAnalysis): string[] {
  const candidates: string[] = [];

  if (analysis.siteId) {
    candidates.push(`https://pub.sleekcms.com/${analysis.siteId}/latest`);
  }

  if (analysis.url) {
    candidates.push(analysis.url);
  }

  if (!analysis.siteId && !analysis.url) {
    candidates.push(`https://pub.sleekcms.com/${analysis.raw}`);
  }

  return Array.from(new Set(candidates));
}

export function buildAuthHeaderCandidates(analysis: TokenAnalysis): string[] {
  const headers: string[] = [];

  analysis.potentialSecrets.forEach((secret) => {
    headers.push(`Bearer ${secret}`);
    headers.push(`PUB_TOKEN ${secret}`);
  });

  headers.push(`Bearer ${analysis.raw}`);
  headers.push(`PUB_TOKEN ${analysis.raw}`);

  return Array.from(new Set(headers));
}


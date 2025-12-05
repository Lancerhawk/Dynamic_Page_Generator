"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchWebsiteData = fetchWebsiteData;
exports.analyzePubToken = analyzePubToken;
exports.buildEndpointCandidates = buildEndpointCandidates;
exports.buildAuthHeaderCandidates = buildAuthHeaderCandidates;
async function fetchWebsiteData(rawPubToken) {
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
                        throw new Error(`Failed to fetch website data: ${response.status} ${response.statusText} - ${errorText}`);
                    }
                }
                catch {
                    continue;
                }
            }
        }
        throw new Error('Unable to fetch SleekCMS data. Please verify your pub token.');
    }
    catch (error) {
        throw new Error(`Error fetching website data: ${error.message}`);
    }
}
function analyzePubToken(token) {
    const result = {
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
        }
        catch { }
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
function buildEndpointCandidates(analysis) {
    const candidates = [];
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
function buildAuthHeaderCandidates(analysis) {
    const headers = [];
    analysis.potentialSecrets.forEach((secret) => {
        headers.push(`Bearer ${secret}`);
        headers.push(`PUB_TOKEN ${secret}`);
    });
    headers.push(`Bearer ${analysis.raw}`);
    headers.push(`PUB_TOKEN ${analysis.raw}`);
    return Array.from(new Set(headers));
}

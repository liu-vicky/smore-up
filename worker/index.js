export default {
  async fetch(request, env) {
    const requestPath = new URL(request.url).pathname;

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', {status: 405});
    }

    const assetPath = requestPath === '/' ? '/index.html' : requestPath;
    const asset = ASSETS[assetPath];
    if (!asset) {
      return new Response('Not found', {status: 404});
    }

    const bytes = Uint8Array.from(atob(asset.body), character => character.charCodeAt(0));
    const responseBody = request.method === 'HEAD' ? null : bytes;

    return new Response(responseBody, {
      headers: {
        'Content-Type': asset.type,
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  },
};

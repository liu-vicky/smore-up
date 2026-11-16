const json = (data, status = 200) =>
  Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });

function cleanInvite(data) {
  const goalSpec = data?.goalSpec;

  if (
    typeof data?.name !== 'string' ||
    !data.name.trim() ||
    data.name.length > 45 ||
    !goalSpec ||
    !Number.isInteger(goalSpec.count) ||
    goalSpec.count < 1 ||
    goalSpec.count > 999 ||
    !['days', 'weeks', 'months', 'years'].includes(goalSpec.unit)
  ) {
    return null;
  }

  return {
    name: data.name.trim(),
    goalSpec: {
      count: goalSpec.count,
      unit: goalSpec.unit,
    },
  };
}

function alphabetCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  let code = '';

  for (const byte of bytes) {
    if (byte < 234) {
      code += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[byte % 26];
    }

    if (code.length === 10) {
      return code;
    }
  }

  return alphabetCode();
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/api/invites' && request.method === 'POST') {
      if (request.headers.get('Origin') && request.headers.get('Origin') !== url.origin) {
        return json({ error: 'Origin mismatch' }, 403);
      }

      if (!env.BUCKET) {
        return json({ error: 'Invite storage unavailable' }, 503);
      }

      if (Number(request.headers.get('content-length') || 0) > 2048) {
        return json({ error: 'Request too large' }, 413);
      }

      let raw;

      try {
        const body = await request.text();

        if (body.length > 2048) {
          return json({ error: 'Request too large' }, 413);
        }

        raw = JSON.parse(body);
      } catch {
        return json({ error: 'Invalid JSON' }, 400);
      }

      const data = cleanInvite(raw);

      if (!data) {
        return json({ error: 'Invalid campfire' }, 400);
      }

      for (let i = 0; i < 5; i += 1) {
        const code = alphabetCode();
        const key = `campfire-invites/${code}.json`;
        const result = await env.BUCKET.put(key, JSON.stringify(data), {
          httpMetadata: {
            contentType: 'application/json',
          },
          onlyIf: {
            etagDoesNotMatch: '*',
          },
        });

        if (result) {
          return json({ code }, 201);
        }
      }

      return json({ error: 'Please retry' }, 503);
    }

    if (path.startsWith('/api/invites/') && request.method === 'GET') {
      const code = path.slice('/api/invites/'.length).toUpperCase();

      if (!/^[A-Z]{10}$/.test(code)) {
        return json({ error: 'Not found' }, 404);
      }

      if (!env.BUCKET) {
        return json({ error: 'Invite storage unavailable' }, 503);
      }

      const object = await env.BUCKET.get(`campfire-invites/${code}.json`);

      if (!object) {
        return json({ error: 'Not found' }, 404);
      }

      try {
        const data = cleanInvite(await object.json());
        return data ? json(data) : json({ error: 'Not found' }, 404);
      } catch {
        return json({ error: 'Not found' }, 404);
      }
    }

    if (path.startsWith('/api/')) {
      return json({ error: 'Not found' }, 404);
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', { status: 405 });
    }

    const asset = ASSETS[path === '/' ? '/index.html' : path];

    if (!asset) {
      return new Response('Not found', { status: 404 });
    }

    const bytes = Uint8Array.from(atob(asset.body), (char) => char.charCodeAt(0));

    return new Response(request.method === 'HEAD' ? null : bytes, {
      headers: {
        'Content-Type': asset.type,
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  },
};

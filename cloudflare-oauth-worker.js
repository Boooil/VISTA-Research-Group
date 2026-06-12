// Decap CMS GitHub OAuth Proxy — Cloudflare Worker
// 部署前在 Cloudflare Dashboard 设置环境变量 (Settings → Variables)：
//   CLIENT_ID      — GitHub OAuth App Client ID
//   CLIENT_SECRET  — GitHub OAuth App Client Secret
//   REDIRECT_URI   — https://vista-research-group.pages.dev/admin/callback.html
//   SITE_URL       — https://vista-research-group.pages.dev

const DEFAULT_REDIRECT = 'https://vista-research-group.pages.dev/admin/callback.html';
const DEFAULT_SITE = 'https://vista-research-group.pages.dev';

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

async function handleRequest(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  const CLIENT_ID = env.CLIENT_ID;
  const CLIENT_SECRET = env.CLIENT_SECRET;
  const REDIRECT_URI = env.REDIRECT_URI || DEFAULT_REDIRECT;
  const SITE_URL = env.SITE_URL || DEFAULT_SITE;

  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(SITE_URL) });
  }

  // GET /auth — 跳转 GitHub 授权
  if (path === '/auth') {
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      scope: 'repo,user',
      redirect_uri: REDIRECT_URI,
    });
    return Response.redirect(`https://github.com/login/oauth/authorize?${params}`, 302);
  }

  // POST /token — 用 code 换 access_token（被 callback.html 调用）
  if (path === '/token' && request.method === 'POST') {
    try {
      const body = await request.json();
      const code = body.code;
      if (!code) {
        return new Response(JSON.stringify({ error: 'missing code' }), {
          status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders(SITE_URL) },
        });
      }

      const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          code,
          redirect_uri: REDIRECT_URI,
        }),
      });

      const data = await tokenResponse.json();

      if (data.error) {
        return new Response(JSON.stringify({ error: data.error }), {
          status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders(SITE_URL) },
        });
      }

      return new Response(JSON.stringify({ token: data.access_token }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders(SITE_URL) },
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders(SITE_URL) },
      });
    }
  }

  return new Response('OAuth Proxy');
}

export default {
  async fetch(request, env) {
    return handleRequest(request, env);
  },
};

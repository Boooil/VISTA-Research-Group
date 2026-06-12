// Decap CMS GitHub OAuth Proxy — Cloudflare Worker
// 部署于 Cloudflare Workers，作为 CMS 登录时的 token 交换中间层

const OAUTH_CLIENT_ID = 'Ov23liwxDcNVBOzddFQq';
const OAUTH_CLIENT_SECRET = '37b3287a9f8271afb6cd94ccc34b536e317cb7eb';

async function handleRequest(request) {
  const url = new URL(request.url);
  const path = url.pathname;

  // Step 1: CMS 发起登录 → 重定向到 GitHub 授权页
  if (path === '/auth') {
    const redirectUrl = 'https://github.com/login/oauth/authorize?' + new URLSearchParams({
      client_id: OAUTH_CLIENT_ID,
      scope: 'repo,user',
    }).toString();
    return Response.redirect(redirectUrl, 302);
  }

  // Step 2: GitHub 回调 → 用 code 换 token → 返回给 CMS
  if (path === '/callback') {
    const code = url.searchParams.get('code');
    if (!code) {
      return new Response('Missing code parameter', { status: 400 });
    }

    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: OAUTH_CLIENT_ID,
        client_secret: OAUTH_CLIENT_SECRET,
        code,
      }),
    });

    const data = await tokenResponse.json();

    if (data.error) {
      return new Response(JSON.stringify(data), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 返回 HTML，通过 postMessage 将 token 传给 CMS 页面
    const html = `<!DOCTYPE html>
<html><head><script>
  (function() {
    window.opener.postMessage(
      ${JSON.stringify({ token: data.access_token, provider: 'github' })},
      '*'
    );
  })();
</script></head><body><p>登录成功，正在跳转...</p></body></html>`;

    return new Response(html, {
      headers: { 'Content-Type': 'text/html' },
    });
  }

  return new Response('Decap CMS GitHub OAuth Proxy', { status: 200 });
}

// Hook into Cloudflare Worker lifecycle
export default {
  async fetch(request, env, ctx) {
    return handleRequest(request);
  },
};

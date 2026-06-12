@echo off
echo === 1/3 正在构建 Hugo 站点...
hugo --minify --gc --cleanDestinationDir --enableGitInfo --baseURL https://vista-research-group.netlify.app/
if %errorlevel% neq 0 exit /b %errorlevel%

echo === 2/3 正在生成搜索索引...
npx pagefind --site public --force-language zh
if %errorlevel% neq 0 exit /b %errorlevel%

echo === 3/3 正在部署到 Netlify...
netlify deploy --prod --dir=public
echo === 部署完成！

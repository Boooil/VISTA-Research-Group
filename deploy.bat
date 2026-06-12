@echo off
echo === 1/2 正在构建 Hugo 站点...
hugo --minify --gc --cleanDestinationDir --enableGitInfo --baseURL https://vista-research-group.pages.dev/
if %errorlevel% neq 0 exit /b %errorlevel%

echo === 2/2 正在生成搜索索引...
npx pagefind --site public --force-language zh
if %errorlevel% neq 0 exit /b %errorlevel%

echo === 构建完成！可通过 npx serve public 本地预览

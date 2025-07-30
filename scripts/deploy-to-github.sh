#!/bin/bash

# 泰语学习卡片应用 - GitHub部署脚本
# 使用方法: ./scripts/deploy-to-github.sh

set -e

echo "🚀 开始GitHub部署流程..."

# 检查Git是否已初始化
if [ ! -d ".git" ]; then
    echo "📁 初始化Git仓库..."
    git init
    git branch -M main
fi

# 检查是否有远程仓库
if ! git remote get-url origin > /dev/null 2>&1; then
    echo "❌ 错误: 请先添加GitHub远程仓库"
    echo "   使用命令: git remote add origin https://github.com/你的用户名/仓库名.git"
    exit 1
fi

# 检查必要的文件
echo "🔍 检查项目文件..."
required_files=("package.json" "README.md" ".env.example" ".github/workflows/deploy.yml")
for file in "${required_files[@]}"; do
    if [ ! -f "$file" ]; then
        echo "❌ 缺少必要文件: $file"
        exit 1
    fi
done

# 安装依赖
echo "📦 安装依赖..."
npm install

# 运行构建测试
echo "🔨 测试构建..."
npm run build

# 添加所有文件
echo "📝 添加文件到Git..."
git add .

# 检查是否有更改
if git diff --staged --quiet; then
    echo "ℹ️  没有新的更改需要提交"
else
    # 提交更改
    echo "💾 提交更改..."
    commit_message="Deploy: $(date +'%Y-%m-%d %H:%M:%S') - Updated Thai learning cards app"
    git commit -m "$commit_message"
fi

# 推送到GitHub
echo "🌐 推送到GitHub..."
git push origin main

echo ""
echo "✅ 部署完成！"
echo ""
echo "📋 接下来的步骤:"
echo "1. 访问你的GitHub仓库页面"
echo "2. 点击 'Settings' → 'Secrets and variables' → 'Actions'"
echo "3. 添加以下密钥:"
echo "   - DATABASE_URL (你的生产数据库URL)"
echo "   - OSS_ACCESS_KEY_ID (阿里云OSS访问密钥)"
echo "   - OSS_ACCESS_KEY_SECRET (阿里云OSS密钥)"
echo "   - OSS_BUCKET_NAME (OSS存储桶名称)"
echo "   - OSS_REGION (OSS区域)"
echo ""
echo "🔗 推荐的部署平台:"
echo "   - Vercel: https://vercel.com (推荐)"
echo "   - Netlify: https://netlify.com"
echo "   - Railway: https://railway.app"
echo ""
echo "🎉 GitHub Actions将自动运行测试和构建!"
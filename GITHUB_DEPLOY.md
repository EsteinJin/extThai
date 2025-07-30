# GitHub 部署指南

## 快速开始 (5分钟部署)

### 1️⃣ 创建GitHub仓库

1. 访问 [GitHub](https://github.com)，点击 "New repository"
2. 仓库名称: `thai-learning-cards` (或你喜欢的名称)
3. 设置为 Public 或 Private
4. 点击 "Create repository"

### 2️⃣ 上传代码

在项目目录执行以下命令:

```bash
# 运行自动部署脚本
./scripts/deploy-to-github.sh
```

如果脚本无法执行，手动运行:

```bash
# 初始化Git
git init
git branch -M main

# 添加远程仓库 (替换为你的仓库地址)
git remote add origin https://github.com/你的用户名/thai-learning-cards.git

# 添加并提交文件
git add .
git commit -m "Initial commit: Thai learning cards app"

# 推送到GitHub
git push -u origin main
```

### 3️⃣ 配置密钥

在GitHub仓库页面:
1. Settings → Secrets and variables → Actions
2. 点击 "New repository secret" 添加:

```
DATABASE_URL=你的数据库连接字符串
OSS_ACCESS_KEY_ID=你的阿里云OSS访问密钥ID
OSS_ACCESS_KEY_SECRET=你的阿里云OSS密钥
OSS_BUCKET_NAME=你的OSS存储桶名称
OSS_REGION=oss-ap-northeast-2
```

### 4️⃣ 选择部署平台

#### 🚀 推荐: Vercel (最简单)

1. 访问 [vercel.com](https://vercel.com)
2. 用GitHub账号登录
3. 点击 "Import Project"
4. 选择你的仓库
5. 添加环境变量 (与GitHub Secrets相同)
6. 点击 "Deploy" - 完成!

#### 🌐 备选: Netlify

1. 访问 [netlify.com](https://netlify.com)
2. "New site from Git"
3. 选择GitHub仓库
4. 构建设置:
   - Build command: `npm run build`
   - Publish directory: `dist/public`
5. 添加环境变量
6. Deploy!

#### 🚂 备选: Railway

1. 访问 [railway.app](https://railway.app)
2. "Deploy from GitHub repo"
3. 选择仓库
4. 添加环境变量
5. 自动部署!

## 数据库推荐

### 🥇 Neon Database (PostgreSQL)
- 免费: 500MB存储 + 3GB传输
- 网址: [neon.tech](https://neon.tech)
- 无需信用卡

### 🥈 Supabase (PostgreSQL + Auth)
- 免费: 500MB存储 + 5GB传输
- 网址: [supabase.com](https://supabase.com)
- 包含认证功能

### 🥉 Railway (PostgreSQL)
- 免费: $5/月额度
- 网址: [railway.app](https://railway.app)
- 一站式部署

## 环境变量获取

### 数据库URL示例:
```bash
# Neon Database
DATABASE_URL="postgresql://user:pass@ep-xxx.us-east-1.aws.neon.tech/thai_cards?sslmode=require"

# Supabase
DATABASE_URL="postgresql://postgres:pass@db.xxx.supabase.co:5432/postgres"

# Railway
DATABASE_URL="postgresql://postgres:pass@containers-us-west-xxx.railway.app:5432/railway"
```

### OSS配置 (可选):
- 登录 [阿里云控制台](https://oss.console.aliyun.com)
- 创建AccessKey: 头像 → AccessKey管理
- 创建存储桶: 对象存储OSS → 创建Bucket

## 常见问题

**Q: 部署后显示空白页面?**
A: 检查环境变量是否正确配置，特别是DATABASE_URL

**Q: GitHub Actions失败?**
A: 查看Actions标签页的错误日志，通常是环境变量问题

**Q: 数据库连接失败?**
A: 确保数据库URL格式正确，并且包含SSL参数

**Q: OSS功能不工作?**
A: OSS是可选功能，不影响核心功能。检查密钥是否正确

## 验证部署

部署成功后访问你的网站:
1. ✅ 可以上传JSON文件
2. ✅ 卡片显示正常
3. ✅ 语音播放工作
4. ✅ 搜索功能可用
5. ✅ 夜间模式切换

## 更新代码

每次修改代码后:
```bash
git add .
git commit -m "描述你的更改"
git push origin main
```

GitHub Actions会自动重新部署!

---

🎉 **恭喜! 你的泰语学习应用已经部署到云端了!**
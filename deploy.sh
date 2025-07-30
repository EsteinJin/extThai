#!/bin/bash

# 阿里云部署脚本
# 使用方法: ./deploy.sh [production|staging]

set -e

ENVIRONMENT=${1:-production}
APP_NAME="thai-cards"
APP_DIR="/var/www/$APP_NAME"
SERVICE_USER="www-data"

echo "🚀 开始部署 $APP_NAME 到 $ENVIRONMENT 环境..."

# 检查是否为root用户
if [[ $EUID -ne 0 ]]; then
   echo "❌ 此脚本需要root权限运行"
   exit 1
fi

# 创建应用目录
echo "📁 创建应用目录..."
mkdir -p $APP_DIR
mkdir -p $APP_DIR/logs
chown -R $SERVICE_USER:$SERVICE_USER $APP_DIR

# 更新系统包
echo "📦 更新系统包..."
apt update && apt upgrade -y

# 安装Node.js 20
if ! command -v node &> /dev/null; then
    echo "📥 安装Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi

# 安装PM2
if ! command -v pm2 &> /dev/null; then
    echo "📥 安装PM2进程管理器..."
    npm install -g pm2
fi

# 安装Nginx
if ! command -v nginx &> /dev/null; then
    echo "📥 安装Nginx..."
    apt install nginx -y
    systemctl enable nginx
fi

# 配置防火墙
echo "🔥 配置防火墙..."
ufw allow ssh
ufw allow http
ufw allow https
ufw --force enable

# 复制应用文件
echo "📋 复制应用文件..."
cp -r . $APP_DIR/
cd $APP_DIR

# 安装依赖
echo "📦 安装依赖..."
npm ci --only=production

# 构建应用
echo "🔨 构建应用..."
npm run build

# 设置文件权限
chown -R $SERVICE_USER:$SERVICE_USER $APP_DIR

# 配置PM2生态系统
echo "⚙️ 配置PM2..."
sudo -u $SERVICE_USER pm2 delete $APP_NAME 2>/dev/null || true
sudo -u $SERVICE_USER pm2 start ecosystem.config.js --env $ENVIRONMENT

# 保存PM2配置
sudo -u $SERVICE_USER pm2 save
sudo -u $SERVICE_USER pm2 startup

# 配置Nginx
echo "🌐 配置Nginx..."
cat > /etc/nginx/sites-available/$APP_NAME << EOF
server {
    listen 80;
    server_name _;
    
    # 安全头
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    
    # 静态文件缓存
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # 健康检查
    location /health {
        access_log off;
        proxy_pass http://localhost:3000/health;
    }
    
    # 反向代理
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 60s;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
    }
}
EOF

# 启用Nginx站点
rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/$APP_NAME /etc/nginx/sites-enabled/

# 测试Nginx配置
nginx -t

# 重启Nginx
systemctl restart nginx

# 创建日志轮转配置
cat > /etc/logrotate.d/$APP_NAME << EOF
$APP_DIR/logs/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 $SERVICE_USER $SERVICE_USER
    postrotate
        sudo -u $SERVICE_USER pm2 reloadLogs
    endscript
}
EOF

echo "✅ 部署完成！"
echo "🌐 应用已在 http://$(curl -s ifconfig.me) 上运行"
echo "📊 使用 'pm2 monit' 监控应用状态"
echo "📝 日志位置: $APP_DIR/logs/"

# 显示服务状态
echo "📋 服务状态:"
systemctl status nginx --no-pager -l
sudo -u $SERVICE_USER pm2 status
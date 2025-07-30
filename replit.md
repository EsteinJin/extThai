# Thai Language Learning Card Application

## Overview

This is a full-stack web application for learning Thai language vocabulary through interactive flashcards. The application allows users to upload JSON files containing Thai words with Chinese translations, pronunciations, and example sentences, then provides an interactive learning interface with audio playback capabilities.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for client-side routing
- **UI Components**: Radix UI with shadcn/ui component library
- **Styling**: Tailwind CSS with custom design system
- **State Management**: TanStack Query (React Query) for server state
- **Build Tool**: Vite with React plugin

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **Database**: SQLite with Drizzle ORM (local file-based, no external costs)
- **File Upload**: Multer for handling multipart/form-data
- **Development**: TSX for TypeScript execution

### Database Schema
- **Users Table**: Basic user authentication (id, username, password)
- **Cards Table**: Vocabulary cards (id, thai, chinese, pronunciation, example, example_translation)
- **Validation**: Zod schemas for runtime type checking

## Key Components

### Data Flow
1. **File Upload**: Users upload JSON files containing card data
2. **Validation**: Server validates JSON structure using Zod schemas
3. **Storage**: Cards are stored in PostgreSQL database via Drizzle ORM
4. **Retrieval**: Frontend fetches cards via REST API
5. **Learning Interface**: Interactive flashcards with audio playback

### Authentication & Authorization
- Basic user authentication system (currently minimal implementation)
- Session-based authentication with PostgreSQL session store
- User registration and login endpoints

### External Dependencies
- **Database**: Local SQLite file (no external costs or dependencies)
- **Audio**: Browser Speech Synthesis API for text-to-speech functionality
- **File Processing**: Client-side JSON validation and server-side file handling
- **UI Components**: Radix UI primitives with shadcn/ui styling

### API Structure
- `GET /api/cards` - Retrieve all vocabulary cards
- `POST /api/cards/upload` - Upload JSON file with card data
- File upload supports bulk card creation with automatic data clearing

## Deployment Strategy

### Development Environment
- **Runtime**: Node.js 20 with Replit environment
- **Database**: PostgreSQL 16 module in Replit
- **Port Configuration**: Local port 5000, external port 80
- **Hot Reload**: Vite development server with HMR

### Production Build
- **Frontend**: Vite build output to `dist/public`
- **Backend**: ESBuild bundle to `dist/index.js`
- **Deployment**: Replit autoscale deployment target
- **Environment**: Production mode with optimized builds

### Database Management
- **Database**: SQLite (local file-based, completely free)
- **File Location**: `./database.sqlite` in project root
- **ORM**: Drizzle ORM with SQLite dialect
- **Migrations**: Auto-initialization on startup, no external dependencies

## Deployment Guide

### 阿里云部署步骤

#### 1. 准备工作
- 阿里云ECS实例 (推荐配置: 2核4GB，Ubuntu 22.04)
- 域名(可选，用于绑定自定义域名)
- 阿里云RDS PostgreSQL数据库实例

#### 2. 服务器环境配置
```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 安装PM2进程管理器
sudo npm install -g pm2

# 安装Nginx
sudo apt install nginx -y
```

#### 3. 代码部署
```bash
# 克隆代码到服务器
git clone <your-repo-url> /var/www/thai-cards
cd /var/www/thai-cards

# 安装依赖
npm install

# 构建前端
npm run build

# 设置环境变量
sudo nano /etc/environment
# 添加以下内容:
DATABASE_URL="postgresql://username:password@your-rds-host:5432/database_name"
NODE_ENV="production"
PORT="3000"
```

#### 4. PM2配置
创建 `ecosystem.config.js`:
```javascript
module.exports = {
  apps: [{
    name: 'thai-cards',
    script: 'dist/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
}
```

#### 5. Nginx配置
创建 `/etc/nginx/sites-available/thai-cards`:
```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

#### 6. 启动服务
```bash
# 启用Nginx配置
sudo ln -s /etc/nginx/sites-available/thai-cards /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# 启动应用
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

#### 7. SSL证书(可选)
```bash
# 安装Certbot
sudo apt install certbot python3-certbot-nginx -y

# 获取SSL证书
sudo certbot --nginx -d your-domain.com
```

## Changelog

Changelog:
- June 25, 2025. Initial setup
- June 25, 2025. Added deployment guide for Aliyun
- July 28, 2025. Major interactive improvements:
  - Added keyboard shortcuts (Space/Arrow keys navigation, A for auto-play, D for dark mode)
  - Implemented touch/swipe gesture support for mobile devices
  - Added auto-play audio functionality when cards change
  - Implemented dark mode toggle with proper CSS variables
  - Moved batch download functionality to file management page
  - Added search functionality to filter cards by Thai text, Chinese, or pronunciation
  - Added card management features (edit/delete buttons for individual cards)
  - Removed file management from main navigation menu (accessible via direct link only)
  - Enhanced learning page with single-card view and navigation controls
  - Added keyboard shortcuts help display
  - Fixed CORS issues with audio download proxy

- July 28, 2025. JSON file accumulative upload and OSS integration:
  - Changed JSON upload behavior from replace to accumulate/append data
  - Integrated Alibaba Cloud OSS for cloud synchronization and backup
  - Added OSS service with automatic card backup after uploads
  - Implemented OSS status checking and configuration management
  - Added restore from OSS backup functionality
  - Updated batch download to exclude word audio (only card images and example audio)
  - Added card clearing functionality with OSS sync
  - Enhanced file management page with OSS status display and controls

- July 28, 2025. Selective download functionality:
  - Added checkbox selection for individual cards in file management
  - Implemented "select all" functionality with counter display
  - Enhanced download button to show selection count
  - Added proper card deletion functionality with confirmation
  - Updated download service to handle selected cards only

- July 28, 2025. GitHub deployment preparation:
  - Created comprehensive GitHub Actions workflow for CI/CD
  - Added detailed README.md with deployment instructions
  - Updated .gitignore for proper version control
  - Created deployment script for automated GitHub pushes
  - Updated environment variable examples for cloud deployment
  - Added support for multiple deployment platforms (Vercel, Netlify, Railway)

- July 29, 2025. Critical path resolution fixes:
  - Fixed TypeError [ERR_INVALID_ARG_TYPE] with import.meta.dirname in vite.config.ts
  - Replaced import.meta.dirname with process.cwd() for reliable path resolution
  - Fixed server/vite.ts path resolution using fileURLToPath approach
  - Removed upload button from learning page empty state per user request
  - Rebuilt application to ensure all fixes are applied in production build
  - All core functionality now stable: course management, file operations, learning interface

- July 29, 2025. Learning progress tracking system:
  - Implemented local storage-based progress tracking service
  - Added automatic progress save/restore functionality for each level
  - Created visual progress indicators with completion percentage
  - Added card completion marking with keyboard shortcut (C key)
  - Enhanced course selection page with progress display for each level
  - Added completed card counter and progress bar in learning interface
  - Progress persists across sessions (24-hour retention policy)
  - Users can now resume learning from where they left off

- July 30, 2025. Backend audio and image generation system:
  - Implemented complete backend resource generation API (/api/cards/generate)
  - Added word_audio, example_audio, and card_image fields to database schema
  - Created generation button in file management for selected cards batch processing
  - Updated frontend audio playback to prioritize backend-generated files over external API
  - Added SVG-based card image generation (avoiding Canvas dependency issues)
  - Implemented backend audio generation using soundoftext API with local file storage
  - Added /api/audio/generated route to serve backend-generated audio files
  - Enhanced auto-play functionality to use generated audio files for faster performance
  - Fixed array bounds checking in learning page to prevent undefined access errors
  - Optimized mobile experience with immersive full-screen flashcard interface

- July 30, 2025. OSS removal and tech stack optimization:
  - Removed Alibaba Cloud OSS integration to reduce complexity and dependencies
  - Uninstalled ali-oss package and removed all OSS-related code
  - Simplified file management page by removing cloud sync functionality
  - Replaced unreliable soundoftext API with browser Speech Synthesis API
  - Created comprehensive tech stack analysis (TECH_STACK_ANALYSIS.md)
  - Removed audio delay between word and example for seamless playback
  - Fixed all OSS-related LSP errors and cleaned up unused imports
  - Application now uses 95% free and open-source technologies
  - Fixed card display issues and count errors in learning interface
  - Improved homepage with full-screen course selection design
  - Fixed JSON file upload functionality by removing OSS dependencies
  - Enhanced error logging for better debugging of upload issues
  - Migrated from PostgreSQL to SQLite for cost-free local storage
  - Fixed JSON upload ID conflicts by auto-generating IDs instead of using JSON IDs

- July 30, 2025. Audio performance optimization and UX improvements:
  - Fixed audio playback speed issues by prioritizing Speech Synthesis API
  - Implemented intelligent audio fallback system (TTS -> External API)
  - Added proper error handling to prevent skipping word audio
  - Optimized audio timing with small delays for better listening experience
  - Enhanced batch delete functionality in file management
  - Added navigation buttons and tips to learning page
  - Implemented automatic audio stop when returning to homepage
  - Created comprehensive README documentation
  - Improved mobile Safari audio compatibility with timeout handling

- July 30, 2025. Random card sampling and learning optimization:
  - Implemented random card selection for learning sessions (max 10 cards per session)
  - Added Fisher-Yates shuffle algorithm for true randomization
  - Ensured no duplicate cards within a session unless all cards are completed
  - Added "换一组" (Change Set) button to get new random card combinations
  - Improved learning experience with manageable card set sizes
  - Enhanced server-side API to support random sampling with configurable limits
  - Updated learning progress tracking to work with random card sets

## User Preferences

Preferred communication style: Simple, everyday language.
Deployment preference: Aliyun cloud deployment.
Font preference: Standard Thai fonts only, no artistic fonts.
File management: Accessible via direct link, not in main menu.
Features prioritized: Keyboard shortcuts, gestures, batch editing, search, night mode, cloud sync.
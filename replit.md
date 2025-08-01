# Thai Language Learning Card Application

## Overview
This project is a full-stack web application designed for learning Thai vocabulary through interactive flashcards. It allows users to upload JSON files containing Thai words with Chinese translations, pronunciations, and example sentences. The application provides an interactive learning interface with audio playback, progress tracking, and various UX enhancements. The business vision is to provide an accessible and effective tool for Thai language learners, with market potential in educational technology. The project aims to offer a feature-rich, user-friendly, and cost-effective learning solution.

## User Preferences
Preferred communication style: Simple, everyday language.
Deployment preference: Aliyun cloud deployment.
Font preference: Standard Thai fonts only, no artistic fonts.
File management: Accessible via direct link, not in main menu.
Features prioritized: Keyboard shortcuts, gestures, batch editing, search, night mode, cloud sync.
UX priorities: Minimize page refreshes, stable browsing experience, visual card browsing with thumbnails.
Navigation preference: Card browser return button should go to homepage instead of course selection.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter
- **UI Components**: Radix UI with shadcn/ui
- **Styling**: Tailwind CSS
- **State Management**: TanStack Query (React Query)
- **Build Tool**: Vite

### Backend
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript (ES modules)
- **Database**: SQLite with Drizzle ORM (local, file-based)
- **File Upload**: Multer
- **Development**: TSX

### Database Schema
- **Users**: Basic authentication (id, username, password)
- **Cards**: Vocabulary cards (id, thai, chinese, pronunciation, example, example_translation, word_audio, example_audio, card_image)
- **Validation**: Zod schemas

### Key Features & Design Choices
- **Data Flow**: JSON file upload, server-side validation (Zod), SQLite storage via Drizzle, REST API for retrieval, interactive learning interface.
- **Learning Interface**: Interactive flashcards with flip animations, keyboard shortcuts, touch/swipe gestures, auto-play audio, dark mode, random card sampling (max 10 per session), "Change Set" button.
- **Card Browsing**: New thumbnail grid view for visual card browsing. Mixed display format (Thai word + Chinese translation + example preview). Click-to-expand detail view with full audio support. Optimized caching to prevent unwanted page refreshes.
- **Progress Tracking**: Local storage-based progress tracking per level, visual indicators, completion marking, session persistence (24-hour retention).
- **Resource Generation**: Backend API for generating word audio (using Browser Speech Synthesis API) and SVG-based card images. Prioritizes generated audio over external TTS.
- **File Management**: Bulk JSON upload (accumulative/append), search, card management (edit/delete individual cards), selective download. New uploaded files highlighted, auto-selected, and top-positioned.
- **UX/UI Decisions**: Redesigned learning interface with floating control panel, slim progress indicator, circular buttons, interactive help modal with shortcut references. Added card browser with responsive grid layout. Optimized for mobile responsiveness (flashcard size, compact layouts).
- **API Endpoints**: `GET /api/cards`, `POST /api/cards/upload`, `/api/cards/generate`, `/api/audio/generated`.

## External Dependencies
- **Database**: SQLite (local file)
- **Audio**: Browser Speech Synthesis API (for text-to-speech)
- **File Processing**: Multer (server-side multipart/form-data handling)
- **UI Libraries**: Radix UI, shadcn/ui
- **ORM**: Drizzle ORM
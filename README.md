# 🌟 Nimo

A social media platform that combines the best of **Instagram** (visual content, image posts) and **X/Twitter** (short-form text, real-time interactions, polls, and reposts).

![Nimo](https://img.shields.io/badge/Nimo-Social%20Media-blue?style=for-the-badge) ![React](https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black) ![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white) ![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white)

## ✨ Features

### Core Features
- 📝 **Text Posts** - Share thoughts with up to 280 characters with clickable #hashtags and @mentions
- 📸 **Image Posts** - Share multi-image posts with responsive carousels
- 📊 **Interactive Polls** - Create 2–4 option polls with custom durations (1d, 3d, 7d) and live animated voting percentages
- 🔄 **Reposts & Quote Posts** - Instantly repost to your followers or quote posts with commentary
- 🔗 **Dedicated Post Detail Page (`/post/:id`)** - Shareable permalinks, deep-linking, full reply threads, and copy link tools
- 👁️ **View Impressions Tracking** - Track unique post impressions and view counters
- 😄 **Emoji Reactions** - React to posts with emojis (`❤️`, `🔥`, `😂`, `😮`, `😢`, `👍`)
- ❤️ **Like & Comment** - Interact with posts and join conversation threads
- 🔖 **Bookmarks** - Save favorite posts to revisit anytime
- 👥 **Follow & Connection System** - Follow users, send connection requests, and manage social circles
- 🔔 **Real-Time Notifications** - Instant alerts for likes, comments, follows, mentions, reactions, and connections
- 💬 **Direct Messages** - Real-time private chat conversations powered by Socket.io
- 🔍 **Search & Explore** - Discover users, posts, trending hashtags, and algorithmically ranked feeds

### User Experience
- 🎨 **Modern Dark Aesthetic** - Sleek glassmorphism and modern UI designed with Tailwind CSS
- 📱 **Fully Responsive** - Flawless experience on mobile, tablet, and desktop
- ⚡ **Lightning Fast** - Built on Vite and React 19 for instantaneous navigation

## 🏗️ Architecture

```
nimo/
├── client/                 # React 19 Frontend (Vite + Tailwind CSS)
│   ├── src/
│   │   ├── components/     # UI Components (PostCard, PollCard, QuoteModal, etc.)
│   │   ├── contexts/       # Auth Context & State Management
│   │   ├── pages/          # Pages (Feed, PostDetail, Profile, Explore, etc.)
│   │   ├── services/       # Axios API client
│   │   ├── types/          # TypeScript definitions
│   │   └── utils/          # Helper functions
│   └── package.json
│
├── server/                 # Express Backend (TypeScript + Mongoose)
│   ├── src/
│   │   ├── models/         # Mongoose Schemas (Post, Poll, Repost, View, User, etc.)
│   │   ├── routes/         # REST API routes
│   │   ├── middleware/     # JWT Auth & Rate Limiters
│   │   └── config/         # Database & Cloudinary config
│   └── package.json
│
└── README.md
```

## 🚀 Quick Start

### Prerequisites
- Node.js (v18 or higher)
- MongoDB (local or MongoDB Atlas)
- npm or yarn

### 1. Clone & Install

```bash
# Clone the repository
git clone https://github.com/anandtudu078/nimo.git
cd nimo

# Install all dependencies
npm run install:all
```

### 2. Configure Environment

Create a `.env` file in the `server/` directory:

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/nimo
JWT_SECRET=your-super-secret-jwt-key
CLIENT_URL=http://localhost:5173
```

### 3. Start Development Servers

```bash
# Start both client and server concurrently
npm run dev

# Or start them separately:
npm run dev:client   # Frontend on http://localhost:5173
npm run dev:server   # Backend on http://localhost:5000
```

### 4. Open the App

Visit [http://localhost:5173](http://localhost:5173) in your browser!

## 📚 API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login user |
| GET | `/api/auth/me` | Get current user |

### Posts
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/posts` | Create post (supports text, images, polls, quotes) |
| GET | `/api/posts/feed?tab=foryou\|following` | Get feed |
| GET | `/api/posts/:id` | Get single post detail with comments & poll |
| GET | `/api/posts/user/:userId` | Get user posts |
| POST | `/api/posts/:id/like` | Like/unlike post |
| POST | `/api/posts/:id/comment` | Add comment |
| PUT | `/api/posts/:id` | Edit post content |
| DELETE | `/api/posts/:id` | Delete post |
| POST | `/api/posts/:id/bookmark` | Toggle post bookmark |

### Polls & Reposts
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/polls/:postId` | Create poll for post |
| GET | `/api/polls/:postId` | Get poll status & votes |
| POST | `/api/polls/:postId/vote` | Vote on a poll option |
| POST | `/api/reposts/:postId` | Toggle repost (share/unshare) |
| GET | `/api/reposts/check/:postId` | Check if current user reposted |
| POST | `/api/reposts/check-multiple` | Batch check repost statuses |

### Views & Reactions
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/views/:postId` | Record a unique post view impression |
| GET | `/api/views/:postId/analytics` | Get analytics for post author |
| POST | `/api/reactions/:postId` | React to post with emoji |
| GET | `/api/reactions/:postId` | Get emoji reactions breakdown |

### Users & Connections
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users/:userId` | Get user profile |
| PUT | `/api/users/me` | Update profile |
| POST | `/api/users/:userId/follow` | Follow/unfollow user |
| POST | `/api/connections/request/:userId` | Send connection request |
| PUT | `/api/connections/accept/:requestId` | Accept connection request |

### Messages & Notifications
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/messages/conversations` | Get user conversations |
| GET | `/api/messages/:conversationId` | Get message history |
| POST | `/api/messages` | Send direct message |
| GET | `/api/notifications` | Get notifications |
| PUT | `/api/notifications/:id/read` | Mark notification as read |
| PUT | `/api/notifications/read-all` | Mark all notifications read |

## 🛠️ Tech Stack

### Frontend
- ⚛️ **React 19** - Component architecture
- ⚡ **Vite** - High performance build tool & dev server
- 🎨 **Tailwind CSS** - Modern dark-mode styling
- 🔀 **React Router 7** - Client-side routing with deep linking
- 📡 **Axios** - HTTP client
- 🔌 **Socket.io Client** - Real-time communication
- 🎯 **React Icons** - Feather & FontAwesome icon set
- 📅 **date-fns** - Lightweight date formatting & calculations

### Backend
- 🚀 **Express.js** - REST API framework
- 🍃 **MongoDB & Mongoose** - Document database & ODM
- 🔌 **Socket.io** - Real-time messaging
- 🔐 **JWT & bcryptjs** - Secure authentication & password hashing
- ☁️ **Cloudinary & Multer** - Image upload processing
- 🛡️ **express-rate-limit** - API security and rate limiting

## 🚢 Deployment

### Frontend (Vercel / Netlify)
```bash
cd client
npm run build
# Deploy the `dist` directory
```

### Backend (Railway / Render / Docker)
```bash
cd server
npm run build
npm start
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

Made with ❤️ by the Nimo Team

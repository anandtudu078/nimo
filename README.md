# 🌟 Nimo

A social media platform that combines the best of **Instagram** (visual content, image posts) and **X/Twitter** (short-form text, real-time interactions).

![Nimo](https://img.shields.io/badge/Nimo-Social%20Media-blue?style=for-the-badge) ![React](https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black) ![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white) ![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white)

## ✨ Features

### Core Features
- 📝 **Text Posts** - Share thoughts with up to 280 characters (X-style)
- 📸 **Image Posts** - Share photos with multiple images (Instagram-style)
- ❤️ **Like & Comment** - Interact with posts
- 👥 **Follow System** - Follow/unfollow users
- 🔔 **Notifications** - Real-time alerts for likes, comments, follows
- 💬 **Direct Messages** - Private conversations between users
- 🔍 **Search** - Find users and posts

### User Experience
- 🎨 **Modern UI** - Clean, responsive design with Tailwind CSS
- 📱 **Mobile-Friendly** - Works great on all screen sizes
- 🌙 **Dark Mode Ready** - Easy to add dark mode support
- ⚡ **Fast & Smooth** - Optimized performance with Vite

## 🏗️ Architecture

```
nimo/
├── client/                 # React Frontend
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── contexts/       # React Context (Auth)
│   │   ├── pages/          # Page components
│   │   ├── services/       # API services
│   │   └── utils/          # Helper functions
│   └── package.json
│
├── server/                 # Express Backend
│   ├── src/
│   │   ├── models/         # MongoDB schemas
│   │   ├── routes/         # API routes
│   │   ├── middleware/      # Auth middleware
│   │   └── utils/          # Helper functions
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
git clone <your-repo-url>
cd nimo

# Install all dependencies
npm run install:all
```

### 2. Configure Environment

Create `.env` file in the `server/` directory:

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/nimo
JWT_SECRET=your-super-secret-jwt-key-change-this
CLIENT_URL=http://localhost:5173
```

### 3. Start Development Servers

```bash
# Start both client and server
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
| POST | `/api/posts` | Create post |
| GET | `/api/posts/feed` | Get feed |
| GET | `/api/posts/user/:userId` | Get user posts |
| POST | `/api/posts/:id/like` | Like/unlike post |
| POST | `/api/posts/:id/comment` | Add comment |
| DELETE | `/api/posts/:id` | Delete post |

### Users
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users/:userId` | Get user profile |
| PUT | `/api/users/me` | Update profile |
| POST | `/api/users/:userId/follow` | Follow/unfollow |

### Messages
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/messages/conversations` | Get conversations |
| POST | `/api/messages/conversation/:userId` | Create/get conversation |
| GET | `/api/messages/:conversationId` | Get messages |
| POST | `/api/messages` | Send message |

### Notifications
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/notifications` | Get notifications |
| PUT | `/api/notifications/:id/read` | Mark as read |

### Search
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/search?q=query&type=users` | Search users/posts |

## 🛠️ Tech Stack

### Frontend
- ⚛️ **React 18** - UI library
- ⚡ **Vite** - Build tool & dev server
- 🎨 **Tailwind CSS** - Utility-first CSS
- 🔀 **React Router** - Client-side routing
- 📡 **Axios** - HTTP client
- 🎯 **React Icons** - Icon library

### Backend
- 🚀 **Express.js** - Web framework
- 🍃 **MongoDB** - Database
- 📦 **Mongoose** - ODM
- 🔐 **JWT** - Authentication
- 🔒 **bcryptjs** - Password hashing

## 🎨 Design System

### Colors
- Primary: Blue (#3B82F6)
- Background: Gray (#F9FAFB)
- Text: Dark gray (#111827)

### Components
- `.btn-primary` - Main action buttons
- `.btn-secondary` - Secondary buttons
- `.btn-outline` - Outline buttons
- `.input-field` - Form inputs
- `.card` - Content cards
- `.avatar` - User avatars

## 📝 Development

### Adding New Features
1. Create backend route in `server/src/routes/`
2. Add MongoDB model in `server/src/models/`
3. Create frontend page in `client/src/pages/`
4. Add route in `client/src/App.tsx`

### Code Style
- Use TypeScript for type safety
- Follow existing naming conventions
- Add comments for complex logic
- Keep components small and focused

## 🚢 Deployment

### Frontend (Vercel/Netlify)
```bash
cd client
npm run build
# Deploy the `dist` folder
```

### Backend (Railway/Render)
```bash
cd server
npm run build
# Start with: node dist/index.js
```

### Environment Variables for Production
```env
PORT=5000
MONGODB_URI=your-mongodb-atlas-uri
JWT_SECRET=your-production-secret
CLIENT_URL=https://your-frontend-url.com
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Inspired by Instagram and X (Twitter)
- Built with modern web technologies
- Designed for scalability and maintainability

---

Made with ❤️ by the Nimo Team

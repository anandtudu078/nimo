import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Layout from './components/Layout'
import LoadingSpinner from './components/LoadingSpinner'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import FeedPage from './pages/FeedPage'
import ProfilePage from './pages/ProfilePage'
import ExplorePage from './pages/ExplorePage'
import NotificationsPage from './pages/NotificationsPage'
import MessagesPage from './pages/MessagesPage'
import CreatePostPage from './pages/CreatePostPage'
import BookmarksPage from './pages/BookmarksPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex justify-center items-center h-screen"><LoadingSpinner /></div>
  if (!user) return <Navigate to="/login" />
  return <>{children}</>
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex justify-center items-center h-screen"><LoadingSpinner /></div>
  if (user) return <Navigate to="/feed" />
  return <>{children}</>
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route path="/feed" element={<FeedPage />} />
            <Route path="/explore" element={<ExplorePage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/messages" element={<MessagesPage />} />
            <Route path="/bookmarks" element={<BookmarksPage />} />
            <Route path="/create" element={<CreatePostPage />} />
            <Route path="/profile/:userId" element={<ProfilePage />} />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  )
}

import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useUnreadCounts } from '../hooks/useUnreadCounts'
import Avatar from './Avatar'
import { FaHome, FaSearch, FaBell, FaEnvelope, FaUser, FaPenSquare, FaSignOutAlt, FaBookmark } from 'react-icons/fa'

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { messageCount, notificationCount } = useUnreadCounts()

  const navItems = [
    { to: '/feed', icon: <FaHome size={24} />, label: 'Home', badge: 0 },
    { to: '/explore', icon: <FaSearch size={24} />, label: 'Explore', badge: 0 },
    { to: '/notifications', icon: <FaBell size={24} />, label: 'Notifications', badge: notificationCount },
    { to: '/messages', icon: <FaEnvelope size={24} />, label: 'Messages', badge: messageCount },
    { to: '/bookmarks', icon: <FaBookmark size={24} />, label: 'Bookmarks', badge: 0 },
    { to: `/profile/${user?._id}`, icon: <FaUser size={24} />, label: 'Profile', badge: 0 },
  ]

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex min-h-screen bg-black">
      {/* Sidebar */}
      <aside className="w-64 border-r border-gray-800 bg-black flex flex-col sticky top-0 h-screen">
        <div className="p-4">
          <h1 className="text-2xl font-bold text-white">Nimo</h1>
        </div>

        <nav className="flex-1 px-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-4 px-4 py-3 rounded-full mb-1 transition-colors ${
                  isActive ? 'font-semibold text-white' : 'text-gray-300 hover:bg-gray-900'
                }`
              }
            >
              <span className="relative">
                {item.icon}
                {item.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2 bg-blue-600 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </span>
              <span className="text-lg">{item.label}</span>
            </NavLink>
          ))}

          <button
            onClick={() => navigate('/create')}
            className="btn-primary w-full mt-4 flex items-center justify-center gap-2"
          >
            <FaPenSquare size={18} />
            <span>New Post</span>
          </button>
        </nav>

        {/* User section */}
        <div className="p-4 border-t border-gray-800">
          <div className="flex items-center gap-3">
            <Avatar src={user?.avatar} name={user?.displayName || ''} />
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate text-white">{user?.displayName}</p>
              <p className="text-sm text-gray-500 truncate">@{user?.username}</p>
            </div>
            <button onClick={handleLogout} className="text-gray-500 hover:text-red-500" title="Logout">
              <FaSignOutAlt size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 max-w-2xl border-r border-gray-800 min-h-screen">
        <Outlet />
      </main>

      {/* Right Sidebar - Trending */}
      <aside className="w-80 p-4 hidden lg:block">
        <div className="sticky top-4">
          <h2 className="font-bold text-xl mb-4 text-white">Trending</h2>
          <div className="space-y-4">
            <div className="cursor-pointer hover:bg-gray-900 p-3 rounded-xl transition-colors">
              <p className="text-sm text-gray-500">Technology</p>
              <p className="font-semibold text-white">#WebDevelopment</p>
              <p className="text-sm text-gray-500">12.5K posts</p>
            </div>
            <div className="cursor-pointer hover:bg-gray-900 p-3 rounded-xl transition-colors">
              <p className="text-sm text-gray-500">Trending in Tech</p>
              <p className="font-semibold text-white">#AI</p>
              <p className="text-sm text-gray-500">45.2K posts</p>
            </div>
            <div className="cursor-pointer hover:bg-gray-900 p-3 rounded-xl transition-colors">
              <p className="text-sm text-gray-500">Design</p>
              <p className="font-semibold text-white">#UIUX</p>
              <p className="text-sm text-gray-500">8.1K posts</p>
            </div>
          </div>
        </div>
      </aside>
    </div>
  )
}

import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import Avatar from './Avatar'
import { FaHome, FaSearch, FaBell, FaEnvelope, FaUser, FaPenSquare, FaSignOutAlt } from 'react-icons/fa'

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const navItems = [
    { to: '/feed', icon: <FaHome size={24} />, label: 'Home' },
    { to: '/explore', icon: <FaSearch size={24} />, label: 'Explore' },
    { to: '/notifications', icon: <FaBell size={24} />, label: 'Notifications' },
    { to: '/messages', icon: <FaEnvelope size={24} />, label: 'Messages' },
    { to: `/profile/${user?._id}`, icon: <FaUser size={24} />, label: 'Profile' },
  ]

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 border-r border-gray-200 bg-white flex flex-col sticky top-0 h-screen">
        <div className="p-4">
          <h1 className="text-2xl font-bold text-blue-600">Nimo</h1>
        </div>

        <nav className="flex-1 px-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-4 px-4 py-3 rounded-full mb-1 transition-colors ${
                  isActive ? 'bg-blue-50 text-blue-600 font-semibold' : 'hover:bg-gray-100'
                }`
              }
            >
              {item.icon}
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
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center gap-3">
            <Avatar src={user?.avatar} name={user?.displayName || ''} />
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">{user?.displayName}</p>
              <p className="text-sm text-gray-500 truncate">@{user?.username}</p>
            </div>
            <button onClick={handleLogout} className="text-gray-500 hover:text-red-500" title="Logout">
              <FaSignOutAlt size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 max-w-2xl border-r border-gray-200 min-h-screen">
        <Outlet />
      </main>

      {/* Right Sidebar - Trending */}
      <aside className="w-80 p-4 hidden lg:block">
        <div className="card sticky top-4">
          <h2 className="font-bold text-xl mb-4">Trending</h2>
          <div className="space-y-4">
            <div className="cursor-pointer hover:bg-gray-50 p-2 rounded-lg -mx-2">
              <p className="text-sm text-gray-500">Technology</p>
              <p className="font-semibold">#WebDevelopment</p>
              <p className="text-sm text-gray-500">12.5K posts</p>
            </div>
            <div className="cursor-pointer hover:bg-gray-50 p-2 rounded-lg -mx-2">
              <p className="text-sm text-gray-500">Trending in Tech</p>
              <p className="font-semibold">#AI</p>
              <p className="text-sm text-gray-500">45.2K posts</p>
            </div>
            <div className="cursor-pointer hover:bg-gray-50 p-2 rounded-lg -mx-2">
              <p className="text-sm text-gray-500">Design</p>
              <p className="font-semibold">#UIUX</p>
              <p className="text-sm text-gray-500">8.1K posts</p>
            </div>
          </div>
        </div>
      </aside>
    </div>
  )
}

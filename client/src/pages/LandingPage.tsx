import { Link } from 'react-router-dom'
import { FiImage, FiMessageCircle, FiHeart, FiUsers, FiSearch, FiBell } from 'react-icons/fi'

const features = [
  { icon: FiImage, title: 'Visual Posts', desc: 'Share photos and moments with your audience through beautiful image posts.' },
  { icon: FiMessageCircle, title: 'Real-time Chat', desc: 'Connect privately with direct messages and conversations.' },
  { icon: FiHeart, title: 'Engage', desc: 'Like, comment, and interact with the content you love.' },
  { icon: FiUsers, title: 'Follow System', desc: 'Build your network by following creators and friends.' },
  { icon: FiSearch, title: 'Discover', desc: 'Explore trending posts and find new people to follow.' },
  { icon: FiBell, title: 'Notifications', desc: 'Stay updated with real-time alerts for every interaction.' },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-black">
      {/* Navbar */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto border-b border-gray-800">
        <span className="text-2xl font-bold text-white">Nimo</span>
        <div className="flex items-center gap-3">
          <Link to="/login" className="btn-outline text-sm">Sign In</Link>
          <Link to="/register" className="btn-primary text-sm">Get Started</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 pt-20 pb-28 text-center max-w-4xl mx-auto">
        <h1 className="text-5xl md:text-6xl font-extrabold text-white leading-tight">
          Share moments.<br />
          <span className="text-blue-500">Start conversations.</span>
        </h1>
        <p className="mt-6 text-lg text-gray-500 max-w-2xl mx-auto">
          Nimo combines the best of visual storytelling and real-time interaction —
          post photos, share thoughts, and connect with people who matter.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Link to="/register" className="btn-primary text-base px-8 py-3">
            Create Account
          </Link>
          <Link to="/login" className="btn-outline text-base px-8 py-3">
            Sign In
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="bg-gray-950 py-20 px-6 border-t border-b border-gray-800">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-white mb-4">Everything you need</h2>
          <p className="text-center text-gray-500 mb-12 max-w-xl mx-auto">
            A complete social experience — from posting and messaging to discovering new content.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-black border border-gray-800 rounded-2xl p-6 hover:border-gray-700 transition-colors">
                <div className="w-12 h-12 rounded-xl bg-blue-950 text-blue-400 flex items-center justify-center mb-4">
                  <Icon size={24} />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 text-center">
        <h2 className="text-3xl font-bold text-white mb-4">Ready to join Nimo?</h2>
        <p className="text-gray-500 mb-8 max-w-md mx-auto">
          Sign up for free and start sharing your world.
        </p>
        <Link to="/register" className="btn-primary text-base px-10 py-3">
          Get Started — It's Free
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-8 px-6 text-center text-sm text-gray-600">
        © {new Date().getFullYear()} Nimo. Built with ❤️
      </footer>
    </div>
  )
}

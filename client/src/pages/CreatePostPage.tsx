import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { FaImage, FaTimes, FaArrowLeft } from 'react-icons/fa'

export default function CreatePostPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [content, setContent] = useState('')
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [imageUrlInput, setImageUrlInput] = useState('')
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState('')

  const handleAddImage = () => {
    if (imageUrlInput.trim()) {
      setImageUrls([...imageUrls, imageUrlInput.trim()])
      setImageUrlInput('')
    }
  }

  const handleRemoveImage = (index: number) => {
    setImageUrls(imageUrls.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim() && imageUrls.length === 0) {
      setError('Please add some content or images')
      return
    }
    setPosting(true)
    setError('')
    try {
      await api.post('/posts', {
        content,
        images: imageUrls,
      })
      navigate('/feed')
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create post')
    } finally {
      setPosting(false)
    }
  }

  return (
    <div>
      <div className="sticky top-0 bg-white/80 backdrop-blur-md z-10 border-b border-gray-200">
        <div className="px-4 py-3 flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="text-gray-600 hover:text-gray-800">
            <FaArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-bold">New Post</h1>
        </div>
      </div>

      <div className="p-4">
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="flex gap-3">
            <div className="avatar">
              {user?.displayName?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="What's happening?"
                className="w-full resize-none border-none focus:outline-none text-lg placeholder-gray-400 min-h-[200px]"
                maxLength={280}
                autoFocus
              />

              {/* Image Preview */}
              {imageUrls.length > 0 && (
                <div className="grid grid-cols-2 gap-2 mt-4">
                  {imageUrls.map((url, idx) => (
                    <div key={idx} className="relative">
                      <img src={url} alt="" className="w-full h-32 object-cover rounded-xl" />
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(idx)}
                        className="absolute top-2 right-2 bg-gray-800/70 text-white rounded-full p-1.5 hover:bg-gray-800"
                      >
                        <FaTimes size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Image URL */}
              <div className="flex gap-2 mt-4">
                <input
                  type="url"
                  value={imageUrlInput}
                  onChange={(e) => setImageUrlInput(e.target.value)}
                  placeholder="Paste image URL..."
                  className="input-field text-sm flex-1"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleAddImage()
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={handleAddImage}
                  className="btn-secondary text-sm"
                  disabled={!imageUrlInput.trim()}
                >
                  Add
                </button>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
            <div className="flex gap-4 text-blue-600">
              <button type="button" className="hover:bg-blue-50 p-2 rounded-full">
                <FaImage size={20} />
              </button>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-400">
                {content.length}/280
              </span>
              <button
                type="submit"
                disabled={posting || (!content.trim() && imageUrls.length === 0)}
                className="btn-primary"
              >
                {posting ? 'Posting...' : 'Post'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { FaImage, FaTimes, FaArrowLeft, FaSpinner } from 'react-icons/fa'

export default function CreatePostPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [content, setContent] = useState('')
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [imagePreviews, setImagePreviews] = useState<string[]>([])
  const [posting, setPosting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length + imageFiles.length > 4) {
      setError('Maximum 4 images allowed')
      return
    }

    // Validate file sizes
    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) {
        setError('Each image must be under 5MB')
        return
      }
    }

    setImageFiles([...imageFiles, ...files])

    // Create previews
    files.forEach((file) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        setImagePreviews((prev) => [...prev, e.target?.result as string])
      }
      reader.readAsDataURL(file)
    })

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleRemoveImage = (index: number) => {
    setImageFiles(imageFiles.filter((_, i) => i !== index))
    setImagePreviews(imagePreviews.filter((_, i) => i !== index))
  }

  const uploadImages = async (): Promise<string[]> => {
    if (imageFiles.length === 0) return []

    const formData = new FormData()
    imageFiles.forEach((file) => {
      formData.append('images', file)
    })

    const res = await api.post('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data.urls
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim() && imageFiles.length === 0) {
      setError('Please add some content or images')
      return
    }

    setPosting(true)
    setError('')
    try {
      let imageUrls: string[] = []
      if (imageFiles.length > 0) {
        setUploading(true)
        imageUrls = await uploadImages()
        setUploading(false)
      }

      await api.post('/posts', {
        content,
        images: imageUrls,
      })
      navigate('/feed')
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create post')
      setUploading(false)
    } finally {
      setPosting(false)
    }
  }

  return (
    <div>
      <div className="sticky top-0 bg-black/80 backdrop-blur-md z-10 border-b border-gray-800">
        <div className="px-4 py-3 flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-white transition-colors">
            <FaArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-bold text-white">New Post</h1>
        </div>
      </div>

      <div className="p-4">
        {error && (
          <div className="bg-red-950/50 text-red-400 border border-red-900 p-3 rounded-xl mb-4 text-sm">
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
                className="w-full resize-none border-none focus:outline-none text-lg placeholder-gray-500 min-h-[200px] bg-transparent text-white"
                maxLength={280}
                autoFocus
              />

              {/* Image Preview Grid */}
              {imagePreviews.length > 0 && (
                <div className={`grid gap-2 mt-4 ${imagePreviews.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                  {imagePreviews.map((preview, idx) => (
                    <div key={idx} className="relative">
                      <img src={preview} alt="" className="w-full h-40 object-cover rounded-xl" />
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(idx)}
                        className="absolute top-2 right-2 bg-gray-800/80 text-white rounded-full p-1.5 hover:bg-gray-700 border border-gray-600"
                      >
                        <FaTimes size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* File Input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                multiple
                onChange={handleImageSelect}
                className="hidden"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-800">
            <div className="flex gap-4 text-blue-500">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="hover:bg-blue-500/10 p-2 rounded-full transition-colors"
                disabled={imageFiles.length >= 4}
                title={imageFiles.length >= 4 ? 'Max 4 images' : 'Add images'}
              >
                <FaImage size={20} />
              </button>
              <span className="text-sm text-gray-500 self-center">
                {imageFiles.length}/4 images
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500">
                {content.length}/280
              </span>
              <button
                type="submit"
                disabled={posting || uploading || (!content.trim() && imageFiles.length === 0)}
                className="btn-primary"
              >
                {uploading ? (
                  <span className="flex items-center gap-2"><FaSpinner className="animate-spin" /> Uploading...</span>
                ) : posting ? (
                  'Posting...'
                ) : (
                  'Post'
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

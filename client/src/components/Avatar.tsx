interface AvatarProps {
  src?: string | null
  name: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-base',
  lg: 'w-20 h-20 text-2xl',
}

export default function Avatar({ src, name, size = 'md', className = '' }: AvatarProps) {
  const initial = name?.charAt(0).toUpperCase() || '?'

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`${sizeClasses[size]} rounded-full object-cover ${className}`}
      />
    )
  }

  return (
    <div className={`${sizeClasses[size]} rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold flex-shrink-0 ${className}`}>
      {initial}
    </div>
  )
}

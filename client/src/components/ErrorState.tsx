interface ErrorStateProps {
  title?: string
  message?: string
  onRetry?: () => void
}

export default function ErrorState({ title = 'Something went wrong', message, onRetry }: ErrorStateProps) {
  return (
    <div className="text-center py-12 px-6">
      <p className="text-lg font-medium text-red-400">{title}</p>
      {message && <p className="mt-1 text-sm text-gray-500 break-words">{message}</p>}
      {onRetry && (
        <button onClick={onRetry} className="btn-primary text-sm mt-4">
          Try again
        </button>
      )}
    </div>
  )
}

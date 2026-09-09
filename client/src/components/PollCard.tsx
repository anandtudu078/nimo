import { useState, useEffect } from 'react'
import { FaCheckCircle, FaSpinner } from 'react-icons/fa'
import { formatDistanceToNow, isPast } from 'date-fns'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import type { Poll } from '../types'

interface PollCardProps {
  poll: Poll
  postId: string
  onVote?: (updatedPoll: Poll) => void
}

export default function PollCard({ poll: initialPoll, postId, onVote }: PollCardProps) {
  const { user } = useAuth()
  const [poll, setPoll] = useState<Poll>(initialPoll)
  const [voting, setVoting] = useState(false)
  
  // Determine if user has already voted based on voters array
  const findUserVote = (currentPoll: Poll): number | null => {
    if (!user?._id) return null
    for (let i = 0; i < currentPoll.options.length; i++) {
      const voters = currentPoll.options[i].voters || []
      if (voters.some((v: any) => (typeof v === 'string' ? v : v?._id || v) === user._id)) {
        return i
      }
    }
    return null
  }

  const [userVote, setUserVote] = useState<number | null>(() => findUserVote(initialPoll))
  const isExpired = isPast(new Date(poll.endsAt))
  const hasVoted = userVote !== null

  useEffect(() => {
    setPoll(initialPoll)
    setUserVote(findUserVote(initialPoll))
  }, [initialPoll, user?._id])

  const handleVote = async (optionIndex: number) => {
    if (voting || isExpired) return
    setVoting(true)
    try {
      const res = await api.post(`/polls/${postId}/vote`, { optionIndex })
      if (res.data.poll) {
        setPoll(res.data.poll)
        setUserVote(res.data.userVote)
        onVote?.(res.data.poll)
      }
    } catch (error) {
      console.error('Failed to vote on poll', error)
    } finally {
      setVoting(false)
    }
  }

  const totalVotes = poll.totalVotes || poll.options.reduce((sum, opt) => sum + (opt.voters?.length || 0), 0)

  return (
    <div className="my-3 p-3.5 bg-gray-900/70 border border-gray-800 rounded-2xl">
      <div className="space-y-2">
        {poll.options.map((option, idx) => {
          const voteCount = option.voters?.length || 0
          const percentage = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0
          const isSelected = userVote === idx

          if (!hasVoted && !isExpired) {
            // Interactive voting buttons
            return (
              <button
                key={idx}
                onClick={() => handleVote(idx)}
                disabled={voting}
                className="w-full text-left py-2.5 px-4 rounded-xl border border-blue-500/30 hover:border-blue-500 bg-blue-500/5 hover:bg-blue-500/15 text-blue-400 font-medium text-sm transition-all duration-150 flex items-center justify-between group disabled:opacity-60"
              >
                <span className="truncate pr-2">{option.text}</span>
                {voting ? (
                  <FaSpinner className="animate-spin text-xs opacity-0 group-hover:opacity-100" />
                ) : (
                  <span className="text-xs text-blue-400/60 group-hover:text-blue-400 transition-colors">Vote</span>
                )}
              </button>
            )
          }

          // Results view (voted or expired)
          return (
            <div
              key={idx}
              onClick={() => !isExpired && handleVote(idx)}
              className={`relative overflow-hidden rounded-xl border p-2.5 transition-all text-sm ${
                isSelected
                  ? 'border-blue-500/80 bg-blue-950/20 font-semibold'
                  : 'border-gray-800 bg-black/40 text-gray-300'
              } ${!isExpired ? 'cursor-pointer hover:border-gray-700' : ''}`}
            >
              {/* Animated progress bar fill */}
              <div
                className={`absolute inset-y-0 left-0 transition-all duration-500 rounded-xl ${
                  isSelected ? 'bg-blue-600/30' : 'bg-gray-800/60'
                }`}
                style={{ width: `${percentage}%` }}
              />

              {/* Content overlay */}
              <div className="relative z-10 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 truncate">
                  {isSelected && <FaCheckCircle className="text-blue-400 flex-shrink-0 text-xs" />}
                  <span className="truncate">{option.text}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 text-xs">
                  <span className="text-gray-400">{voteCount} {voteCount === 1 ? 'vote' : 'votes'}</span>
                  <span className="font-bold text-white min-w-[2.5rem] text-right">{percentage}%</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Poll Metadata footer */}
      <div className="flex items-center justify-between mt-3 pt-2 text-xs text-gray-500 border-t border-gray-800/60">
        <span>{totalVotes} {totalVotes === 1 ? 'vote' : 'total votes'}</span>
        <span>
          {isExpired ? (
            <span className="text-gray-400 font-medium">Final results</span>
          ) : (
            <span>Ends {formatDistanceToNow(new Date(poll.endsAt), { addSuffix: true })}</span>
          )}
        </span>
      </div>
    </div>
  )
}

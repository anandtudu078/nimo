import { useState } from 'react'
import { FaPlus, FaTimes, FaPollH } from 'react-icons/fa'

export interface PollData {
  options: string[]
  durationHours: number
}

interface PollCreatorProps {
  pollData: PollData
  onChange: (data: PollData) => void
  onRemove: () => void
}

export default function PollCreator({ pollData, onChange, onRemove }: PollCreatorProps) {
  const [activeDuration, setActiveDuration] = useState<number>(pollData.durationHours || 24)

  const handleOptionChange = (index: number, value: string) => {
    const updated = [...pollData.options]
    updated[index] = value
    onChange({ ...pollData, options: updated })
  }

  const handleAddOption = () => {
    if (pollData.options.length < 4) {
      onChange({ ...pollData, options: [...pollData.options, ''] })
    }
  }

  const handleRemoveOption = (index: number) => {
    if (pollData.options.length > 2) {
      const updated = pollData.options.filter((_, i) => i !== index)
      onChange({ ...pollData, options: updated })
    }
  }

  const handleDurationChange = (hours: number) => {
    setActiveDuration(hours)
    onChange({ ...pollData, durationHours: hours })
  }

  return (
    <div className="mt-3 p-3.5 bg-gray-900/90 border border-gray-800 rounded-2xl relative">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-blue-400">
          <FaPollH />
          <span>Create a Poll</span>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="text-xs text-red-400 hover:text-red-300 transition-colors flex items-center gap-1 hover:underline"
        >
          <FaTimes size={12} />
          Remove Poll
        </button>
      </div>

      {/* Options */}
      <div className="space-y-2">
        {pollData.options.map((option, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <input
              type="text"
              value={option}
              onChange={(e) => handleOptionChange(idx, e.target.value)}
              placeholder={`Option ${idx + 1}${idx < 2 ? ' (required)' : ' (optional)'}`}
              maxLength={100}
              className="flex-1 bg-black/60 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
            {pollData.options.length > 2 && (
              <button
                type="button"
                onClick={() => handleRemoveOption(idx)}
                className="text-gray-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-gray-800 transition-colors"
                title="Remove option"
              >
                <FaTimes size={14} />
              </button>
            )}
          </div>
        ))}
      </div>

      {pollData.options.length < 4 && (
        <button
          type="button"
          onClick={handleAddOption}
          className="mt-2 text-xs font-medium text-blue-400 hover:text-blue-300 flex items-center gap-1 py-1 px-2 rounded-lg hover:bg-blue-500/10 transition-colors"
        >
          <FaPlus size={10} />
          Add option ({pollData.options.length}/4)
        </button>
      )}

      {/* Poll Length */}
      <div className="mt-3 pt-3 border-t border-gray-800/80 flex items-center justify-between text-xs">
        <span className="text-gray-400 font-medium">Poll duration:</span>
        <div className="flex gap-1.5">
          {[
            { label: '1 Day', hours: 24 },
            { label: '3 Days', hours: 72 },
            { label: '7 Days', hours: 168 },
          ].map((d) => (
            <button
              key={d.hours}
              type="button"
              onClick={() => handleDurationChange(d.hours)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                activeDuration === d.hours
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

import clsx from 'clsx'
import { Group } from 'common/group'

export function FoldTag(props: { fold: Group }) {
  const { fold } = props
  const { name } = fold
  return (
    <div
      className={clsx(
        'rounded-full bg-white px-4 py-2 shadow-md hover:bg-gray-100',
        'cursor-pointer'
      )}
    >
      <span className="text-gray-500">{name}</span>
    </div>
  )
}

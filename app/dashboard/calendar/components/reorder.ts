/**
 * Reorder utilities for drag-and-drop operations in the Kanban board
 * These utilities help manage the reordering of tasks when they are moved
 * within the same column or between different columns.
 */

export interface ReorderSource {
  droppableId: string
  index: number
}

export interface ReorderDestination {
  droppableId: string
  index: number
}

export interface ReorderTaskMapParams<T = unknown> {
  taskMap: Record<string, T[]>
  source: ReorderSource
  destination: ReorderDestination
}

/**
 * Reorders tasks within a task map when moving between or within columns
 * 
 * @param params - The reorder parameters containing taskMap, source, and destination
 * @returns A new task map with the tasks reordered
 */
export function reorderTaskMap<T = unknown>({
  taskMap,
  source,
  destination
}: ReorderTaskMapParams<T>): Record<string, T[]> {
  // Create a deep copy of the task map to avoid mutations
  const newTaskMap = { ...taskMap }
  
  // Copy arrays to avoid mutations
  Object.keys(newTaskMap).forEach(columnId => {
    newTaskMap[columnId] = [...newTaskMap[columnId]]
  })

  // Get the task that's being moved
  const sourceColumn = newTaskMap[source.droppableId]
  const [movedTask] = sourceColumn.splice(source.index, 1)

  if (source.droppableId === destination.droppableId) {
    // Moving within the same column
    sourceColumn.splice(destination.index, 0, movedTask)
  } else {
    // Moving to a different column
    const destinationColumn = newTaskMap[destination.droppableId]
    destinationColumn.splice(destination.index, 0, movedTask)
  }

  return newTaskMap
}

/**
 * Reorders items within a single array (useful for column reordering)
 * 
 * @param list - The array to reorder
 * @param startIndex - The source index
 * @param endIndex - The destination index
 * @returns A new array with items reordered
 */
export function reorderList<T>(list: T[], startIndex: number, endIndex: number): T[] {
  const result = Array.from(list)
  const [removed] = result.splice(startIndex, 1)
  result.splice(endIndex, 0, removed)
  return result
}

/**
 * Moves an item from one list to another
 * 
 * @param source - The source array
 * @param destination - The destination array
 * @param droppableSource - Source position info
 * @param droppableDestination - Destination position info
 * @returns An object containing both updated arrays
 */
export function move<T>(
  source: T[],
  destination: T[],
  droppableSource: ReorderSource,
  droppableDestination: ReorderDestination
): { [key: string]: T[] } {
  const sourceClone = Array.from(source)
  const destClone = Array.from(destination)
  const [removed] = sourceClone.splice(droppableSource.index, 1)

  destClone.splice(droppableDestination.index, 0, removed)

  const result: { [key: string]: T[] } = {}
  result[droppableSource.droppableId] = sourceClone
  result[droppableDestination.droppableId] = destClone

  return result
}

/**
 * Utility function to calculate the new position for a task based on its neighbors
 * This is useful when working with fractional indexing systems
 * 
 * @param beforeTask - The task that should come before the moved task
 * @param afterTask - The task that should come after the moved task
 * @returns A calculated position value
 */
export function calculateNewPosition(
  beforeTask: { position: number } | null,
  afterTask: { position: number } | null
): number {
  if (!beforeTask && !afterTask) {
    return 0.5
  }
  
  if (!beforeTask && afterTask) {
    return afterTask.position / 2
  }
  
  if (beforeTask && !afterTask) {
    return beforeTask.position + 0.5
  }
  
  return (beforeTask!.position + afterTask!.position) / 2
}
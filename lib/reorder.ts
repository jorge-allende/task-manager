// Utility functions for reordering tasks in the Kanban board

// Reorder items within the same list
export const reorder = <T>(list: T[], startIndex: number, endIndex: number): T[] => {
  const result = Array.from(list);
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);
  return result;
};

// Reorder tasks across different columns
export const reorderTaskMap = ({ 
  taskMap, 
  source, 
  destination 
}: {
  taskMap: Record<string, any[]>;
  source: { droppableId: string; index: number };
  destination: { droppableId: string; index: number };
}) => {
  const current = [...(taskMap[source.droppableId] || [])];
  const next = [...(taskMap[destination.droppableId] || [])];
  const target = current[source.index];

  // Moving within the same column
  if (source.droppableId === destination.droppableId) {
    const reordered = reorder(current, source.index, destination.index);
    return {
      ...taskMap,
      [source.droppableId]: reordered
    };
  }

  // Moving to a different column
  // Remove from original
  current.splice(source.index, 1);
  // Insert into next
  next.splice(destination.index, 0, target);

  return {
    ...taskMap,
    [source.droppableId]: current,
    [destination.droppableId]: next
  };
};

// Helper to move items between two lists
export function moveBetween<T>({ 
  list1, 
  list2, 
  source, 
  destination 
}: {
  list1: { id: string; values: T[] };
  list2: { id: string; values: T[] };
  source: { droppableId: string; index: number };
  destination: { droppableId: string; index: number };
}) {
  const newFirst = Array.from(list1.values);
  const newSecond = Array.from(list2.values);

  const moveFrom = source.droppableId === list1.id ? newFirst : newSecond;
  const moveTo = moveFrom === newFirst ? newSecond : newFirst;

  const [moved] = moveFrom.splice(source.index, 1);
  moveTo.splice(destination.index, 0, moved);

  return {
    list1: {
      ...list1,
      values: newFirst
    },
    list2: {
      ...list2,
      values: newSecond
    }
  };
}
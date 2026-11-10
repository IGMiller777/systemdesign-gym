import type { Task } from './types'
import { estimateTasks } from './estimate'
import { choiceTasks } from './choice'
import { bottleneckTasks } from './bottleneck'
import { designTasks } from './design'
import { frontendTasks } from './frontend'
import { llmTasks } from './llm'

export const allTasks: Task[] = [
  ...estimateTasks,
  ...choiceTasks,
  ...bottleneckTasks,
  ...designTasks,
  ...frontendTasks,
  ...llmTasks,
].sort((a, b) => a.level - b.level)

const byId = new Map<string, Task>(allTasks.map((t) => [t.id, t]))

export function getTask(id: string): Task | undefined {
  return byId.get(id)
}

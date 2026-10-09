import { z } from 'zod'

export const taskContract = z
  .object({
    id: z.int(),
    title: z.string(),
    done: z.boolean(),
  })
  .meta({ id: 'Task', description: 'Liste toutes les tâches, sans pagination.' })

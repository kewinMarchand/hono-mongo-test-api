import { z } from 'zod'

export const taskSchema = z
  .object({
    id: z.int(),
    title: z.string(),
    done: z.boolean(),
  })
  .meta({ id: 'Task', description: 'Liste toutes les tâches, sans pagination.' })

export declare namespace Task {
  type Entity = z.infer<typeof taskSchema>

  interface Repository {
    findAll(): Promise<Entity[]>
  }
}

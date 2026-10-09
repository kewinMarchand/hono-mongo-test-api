export declare namespace Task {
  interface Entity {
    readonly id: number
    readonly title: string
    readonly done: boolean
  }

  interface Repository {
    findAll(): Promise<Entity[]>
  }
}

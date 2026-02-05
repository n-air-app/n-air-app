/**
 * Type definitions for tasklist 5.0.0
 * Windows tasklist command wrapper
 */

declare module 'tasklist' {
  export interface Task {
    imageName: string;
    pid: number;
    sessionName: string;
    sessionNumber: number;
    memUsage: number;
  }

  export function tasklist(options?: { verbose?: boolean }): Promise<Task[]>;
}

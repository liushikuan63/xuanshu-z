export interface CommandSpec {
  command: string;
  args: string[];
  cwd: string;
  label: string;
}

export function resolveCommand(mode?: string, args?: string[]): CommandSpec | null;
export const SUPPORTED_COMMANDS: string[];

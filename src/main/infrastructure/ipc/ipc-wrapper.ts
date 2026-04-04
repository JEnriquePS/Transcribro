import { ipcMain } from 'electron'
import { ZodError } from 'zod'
import type { ZodSchema } from 'zod'
import { DomainError } from '../../domain/errors'
import { ErrorCode } from '../../../shared/errors'

/**
 * Register a typed IPC handler with automatic Zod validation and structured
 * error responses.
 *
 * Every response is wrapped in `{ success, data }` or `{ success, error }`
 * so the renderer always receives a consistent shape.
 *
 * @param channel  IPC channel name
 * @param schema   Zod schema to parse the raw input, or null for void inputs
 * @param handler  Business logic to run after validation
 */
export function handleIpc<TInput, TOutput>(
  channel: string,
  schema: ZodSchema<TInput> | null,
  handler: (input: TInput) => Promise<TOutput> | TOutput,
): void {
  ipcMain.handle(channel, async (_event, rawInput: unknown) => {
    try {
      const input = schema !== null ? schema.parse(rawInput) : (undefined as TInput)
      const data = await handler(input)
      return { success: true, data }
    } catch (error) {
      if (error instanceof DomainError) {
        return {
          success: false,
          error: { code: error.code, message: error.message },
        }
      }
      if (error instanceof ZodError) {
        return {
          success: false,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: error.issues.map((i) => i.message).join('; '),
          },
        }
      }
      console.error(`[ipc] Unhandled error on channel "${channel}":`, error)
      return {
        success: false,
        error: {
          code: ErrorCode.INTERNAL_ERROR,
          message: 'An unexpected error occurred',
        },
      }
    }
  })
}

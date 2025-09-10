/**
 * Debug logging utility for e2e tests
 * Only outputs logs when DEBUG environment variable is set
 */

export class DebugLogger {
  private static isDebugEnabled(): boolean {
    return process.env.DEBUG === 'true' || process.env.DEBUG === '1';
  }

  static log(message: string, ...args: any[]): void {
    if (DebugLogger.isDebugEnabled()) {
      console.log(message, ...args);
    }
  }

  static error(message: string, ...args: any[]): void {
    // Always show errors for debugging
    console.error(message, ...args);
  }

  static warn(message: string, ...args: any[]): void {
    // Always show warnings for debugging
    console.warn(message, ...args);
  }

  static info(message: string, ...args: any[]): void {
    if (DebugLogger.isDebugEnabled()) {
      console.info(message, ...args);
    }
  }

  static debug(message: string, ...args: any[]): void {
    if (DebugLogger.isDebugEnabled()) {
      console.debug(message, ...args);
    }
  }
}

// Export convenience functions
export const debugLog = DebugLogger.log;
export const debugError = DebugLogger.error;
export const debugWarn = DebugLogger.warn;
export const debugInfo = DebugLogger.info;
export const debugDebug = DebugLogger.debug;

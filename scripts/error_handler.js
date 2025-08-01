// scripts/error_handler.js

class ErrorHandler {
  /**
   * Creates a standardized error object.
   * @param {string} message - A descriptive error message.
   * @returns {{success: false, error: string}}
   */
  static createError(message) {
    return {
      success: false,
      error: message,
    };
  }

  static createSuccess(data = null, options = {}) {
    return {
      success: true,
      data: data,
      ...options,
    };
  }
}
/**
 * Inbound (Primary) Port for History / Undo / Redo operations.
 * Defines the contract that driving adapters (UI, Shortcuts, CLI) use to manage undoable state.
 *
 * @interface IHistoryUseCases
 */
export class IHistoryUseCases {
  /**
   * Record a reversible action in the history stack.
   * @param {object} action
   */
  recordAction(action) {
    throw new Error('Not implemented: IHistoryUseCases.recordAction');
  }

  /**
   * Revert the most recent action.
   * @returns {object|null} The undone action, or null if history is empty.
   */
  undo() {
    throw new Error('Not implemented: IHistoryUseCases.undo');
  }

  /**
   * Replay the most recently undone action.
   * @returns {object|null}
   */
  redo() {
    throw new Error('Not implemented: IHistoryUseCases.redo');
  }

  /**
   * Clear all recorded history entries.
   */
  clear() {
    throw new Error('Not implemented: IHistoryUseCases.clear');
  }

  /**
   * @returns {boolean} True if there are actions available to undo.
   */
  canUndo() {
    throw new Error('Not implemented: IHistoryUseCases.canUndo');
  }

  /**
   * @returns {boolean} True if there are actions available to redo.
   */
  canRedo() {
    throw new Error('Not implemented: IHistoryUseCases.canRedo');
  }

  /**
   * @returns {number} Total number of undoable actions in history.
   */
  get count() {
    throw new Error('Not implemented: IHistoryUseCases.count');
  }
}

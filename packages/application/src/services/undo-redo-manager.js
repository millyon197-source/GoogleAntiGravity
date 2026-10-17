import { IHistoryUseCases } from '../ports/inbound/history-use-cases.port.js';

/**
 * Dedicated Application Service managing undo/redo history stacks.
 * Adheres strictly to the Single Responsibility Principle (SRP) by decoupling history
 * tracking and action tooltips from DOM updates and 3D rendering.
 */
export class UndoRedoManager extends IHistoryUseCases {
  /**
   * @param {object} [options]
   * @param {number} [options.maxEntries=100]
   * @param {(macro: string) => string} [options.getFriendlyName]
   */
  constructor({ maxEntries = 100, getFriendlyName = (m) => m } = {}) {
    super();
    this.maxEntries = maxEntries;
    this.getFriendlyName = getFriendlyName;
    /** @type {object[]} */
    this.undoStack = [];
    /** @type {object[]} */
    this.redoStack = [];
    /** @type {Set<Function>} */
    this.listeners = new Set();
  }

  /**
   * Subscribe to history change events.
   * @param {Function} listener
   * @returns {() => void} Unsubscribe callback
   */
  subscribe(listener) {
    if (typeof listener === 'function') {
      this.listeners.add(listener);
    }
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify subscribers of history state change.
   * @private
   */
  notify(justActivated = false) {
    this.listeners.forEach(fn => {
      try {
        fn({ count: this.count, canUndo: this.canUndo(), canRedo: this.canRedo(), justActivated });
      } catch (err) {
        console.error('[UndoRedoManager] Error in history subscriber:', err);
      }
    });
  }

  /**
   * Record a reversible action.
   * @param {object} action
   */
  recordAction(action) {
    if (!action) return;
    const friendlyName = action.friendlyName || this.getFriendlyName(action.macro || '');
    const enrichedAction = {
      ...action,
      friendlyName,
      id: Date.now() + '-' + Math.random().toString(36).substr(2, 4)
    };

    this.undoStack.push(enrichedAction);
    if (this.undoStack.length > this.maxEntries) {
      this.undoStack.shift();
    }
    this.redoStack.length = 0; // Clear redo on new action
    this.notify(true);
  }

  /**
   * Pop and return the most recent action to revert.
   * @returns {object|null}
   */
  undo() {
    if (this.undoStack.length === 0) return null;
    const action = this.undoStack.pop();
    this.redoStack.push(action);
    this.notify(false);
    return action;
  }

  /**
   * Pop and return the most recently reverted action to re-apply.
   * @returns {object|null}
   */
  redo() {
    if (this.redoStack.length === 0) return null;
    const action = this.redoStack.pop();
    this.undoStack.push(action);
    this.notify(false);
    return action;
  }

  /**
   * Peek at the most recent action without removing it.
   * @returns {object|null}
   */
  peek() {
    if (this.undoStack.length === 0) return null;
    return this.undoStack[this.undoStack.length - 1];
  }

  /**
   * Clear all history entries.
   */
  clear() {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    this.notify(false);
  }

  /**
   * @returns {boolean}
   */
  canUndo() {
    return this.undoStack.length > 0;
  }

  /**
   * @returns {boolean}
   */
  canRedo() {
    return this.redoStack.length > 0;
  }

  /**
   * @returns {number}
   */
  get count() {
    return this.undoStack.length;
  }

  /**
   * Returns a copy of the active undo history stack.
   * @returns {object[]}
   */
  getHistory() {
    return [...this.undoStack];
  }

  /**
   * Formats a human-readable tooltip describing the target action.
   * @param {object} [action] - If omitted, uses the top action on the undo stack.
   * @returns {string}
   */
  formatTooltip(action = null) {
    const act = action || this.peek();
    if (!act) return 'No module moves to undo (Ctrl+Z)';

    let desc = '';
    if (act.type === 'move' && act.from && act.to) {
      if (act.operation === 'diamond_center') {
        desc = `Center in Plot: Module #${act.moduleIndex} (${act.friendlyName || 'Module'}) moved to center`;
      } else {
        desc = `Module #${act.moduleIndex} (${act.friendlyName || 'Module'}) moved from (${act.from.x}, ${act.from.y}, ${act.from.z}) to (${act.to.x}, ${act.to.y}, ${act.to.z})`;
      }
    } else if (act.type === 'group_move' && Array.isArray(act.moves)) {
      if (act.operation === 'diamond_center') {
        desc = `Center in Plot: ${act.moves.length} modules moved together to center`;
      } else {
        desc = `Group move: ${act.moves.length} modules moved together`;
      }
    } else if (act.type === 'rotate' && act.fromRot && act.toRot) {
      desc = `Module #${act.moduleIndex} (${act.friendlyName || 'Module'}) rotated`;
    } else if (act.type === 'plot_resize') {
      const fromCfg = act.fromConfig;
      const fromSize = fromCfg ? `${fromCfg.x.plus + fromCfg.x.minus}x${fromCfg.y.plus + fromCfg.y.minus}x${fromCfg.z.plus + fromCfg.z.minus} km` : '';
      desc = `Fit Plot to Blueprint: Plot size changed (revert to ${fromSize})`;
    } else if (act.type === 'set_fefb') {
      desc = `Set FEFB: Module #${act.moduleIndex} (${act.friendlyName || 'Module'}) (revert to ${act.previousFefb !== null && act.previousFefb !== undefined ? `Module #${act.previousFefb}` : 'none'})`;
    }

    const count = this.count;
    return `Undo last module move (Ctrl+Z) • ${count} move${count > 1 ? 's' : ''} in undo history • Right-click to clear list${desc ? `\n${desc}` : ''}`;
  }
}

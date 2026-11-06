/**
 * Adapts three.js TransformControls (r169+) to how the viewer drives its gizmos.
 *
 * Since r169 TransformControls is a `Controls` (not an Object3D): the scene object is a
 * separate helper returned by `getHelper()`, which owns `visible` and the
 * `updateMatrixWorld` the renderer calls. The viewer (and many tests) toggle
 * `tc.visible`, call `tc.updateMatrixWorld()`, and shift the gizmo by a world offset
 * when it is relocated into the viewport during zoom. This module keeps those call
 * sites working against the new structure. Mocks / pre-r169 controls (which are
 * themselves Object3Ds) are handled transparently.
 */

/**
 * Returns the Object3D to add to / remove from the scene for these controls.
 * @param {Object} tc TransformControls (or an Object3D-based mock).
 * @returns {import('three').Object3D}
 */
export function getTransformControlsHelper(tc) {
  return tc && typeof tc.getHelper === 'function' ? tc.getHelper() : tc;
}

/**
 * Installs the viewer's behaviour on a TransformControls instance:
 *  - after the helper's updateMatrixWorld, shift `worldPosition` (and the gizmo / plane)
 *    by `getWorldOffset()` and recompute `eye`, so handles render and pick at the
 *    relocated position;
 *  - forward `tc.updateMatrixWorld(force)` to the helper;
 *  - proxy `tc.visible` to the helper's visibility.
 * Safe to call once per instance; no-op for falsy input.
 *
 * @param {Object} tc TransformControls (or an Object3D-based mock).
 * @param {{ getWorldOffset: () => (import('three').Vector3|null|undefined) }} options
 */
export function adaptTransformControls(tc, { getWorldOffset }) {
  if (!tc) return;
  const helper = getTransformControlsHelper(tc);
  const baseUpdate = typeof helper.updateMatrixWorld === 'function' ? helper.updateMatrixWorld.bind(helper) : null;

  helper.updateMatrixWorld = function (force) {
    if (baseUpdate) baseUpdate(force);
    const offset = getWorldOffset();
    if (!offset || offset.lengthSq() <= 0.0001) return;
    if (tc.worldPosition) {
      tc.worldPosition.add(offset);
    }
    if (tc.camera && tc.eye && tc.cameraPosition && tc.camera.isPerspectiveCamera && tc.worldPosition) {
      tc.eye.copy(tc.cameraPosition).sub(tc.worldPosition).normalize();
    }
    if (tc._gizmo && tc._gizmo.worldPosition) {
      tc._gizmo.worldPosition.copy(tc.worldPosition);
      tc._gizmo.updateMatrixWorld(force);
    }
    if (tc._plane && tc._plane.worldPosition) {
      tc._plane.worldPosition.copy(tc.worldPosition);
      tc._plane.updateMatrixWorld(force);
    }
  };

  if (helper !== tc) {
    tc.updateMatrixWorld = (force) => helper.updateMatrixWorld(force);
    Object.defineProperty(tc, 'visible', {
      configurable: true,
      enumerable: true,
      get: () => helper.visible,
      set: (value) => { helper.visible = value; }
    });
  }
}

import * as THREE from 'three';

// We want a Three.js Object3D rotation/matrix such that for ANY local snap (sx, sy, sz),
// The world position is:
// worldX = mod.position.x + (sx * cos(yaw) + sz * sin(yaw))
// worldY = mod.position.y + sy
// worldZ = -(mod.position.z + (-sx * sin(yaw) + sz * cos(yaw))) = -mod.position.z + sx * sin(yaw) - sz * cos(yaw)

// Let's test what moduleGroup rotation + local pos produces this!
// Suppose local pos of dot is: (lx, ly, lz)
// Group has Euler rotation (rx, ry, rz, 'YXZ')
// Can we find rx, ry, rz and lx, ly, lz?

// Matrix required:
// [  cos(yaw), 0,  sin(yaw) ] * lx + ... -> sx * cos(yaw) + sz * sin(yaw)
// [         0, 1,         0 ] * ly
// [  sin(yaw), 0, -cos(yaw) ] -> sx * sin(yaw) - sz * cos(yaw)

// Notice the required transformation matrix from (sx, sy, sz) to world offset (wx, wy, wz):
// wx = sx * cos(yaw) + sz * sin(yaw)
// wy = sy
// wz = sx * sin(yaw) - sz * cos(yaw)

// Notice the determinant of this matrix:
// det = cos(yaw) * (-cos(yaw)) - sin(yaw) * sin(yaw) = -(cos^2 + sin^2) = -1 !
// The determinant is -1 because it contains a reflection (Z -> -Z)!
console.log('The coordinate mapping from X4 to Three.js has determinant = -1 (a reflection)!');

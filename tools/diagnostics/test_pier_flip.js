import * as THREE from 'three';
import { getModuleSnapPoints } from '../../src/snap-points-db.js';

// Pier 222:
// mod: pos=(885.239, 2051, 9194.614)
// pred 221: pos=(885.239, 2451, 9194.614), conn=connectionsnap002 ([0, -200, 0])
// pier conn: connectionsnap003 ([0, 200, 0])

function checkSnap(yawPier222, yawPier223) {
  const p222 = {
    position: { x: 885.239, y: 2051, z: 9194.614 },
    rotation: { yaw: yawPier222, pitch: 0, roll: 0 }
  };
  const pred221 = {
    position: { x: 885.239, y: 2451, z: 9194.614 },
    rotation: { yaw: 0, pitch: 0, roll: 0 }
  };

  const p223 = {
    position: { x: 1025.842, y: 1251, z: -3204.589 },
    rotation: { yaw: yawPier223, pitch: 0, roll: 0 }
  };
  const pred115 = {
    position: { x: 1025.842, y: 1651, z: -3204.589 },
    rotation: { yaw: 0, pitch: 0, roll: 0 }
  };

  function worldSnap(mod, snapName) {
    const snaps = getModuleSnapPoints('pier_arg_harbor_03_macro');
    const snap = snaps.find(s => s.name.toLowerCase() === snapName.toLowerCase());
    const g = new THREE.Group();
    g.rotation.order = 'YXZ';
    g.rotation.y = mod.rotation.yaw * Math.PI / 180;
    g.rotation.x = (mod.rotation.pitch + 180) * Math.PI / 180;
    g.rotation.z = (mod.rotation.roll + 180) * Math.PI / 180;
    g.position.set(mod.position.x, mod.position.y, -mod.position.z);
    const dot = new THREE.Vector3(-snap.pos[0], snap.pos[1], -snap.pos[2]);
    dot.applyEuler(g.rotation);
    dot.add(g.position);
    return dot;
  }

  function worldSnapPred(mod, snapName) {
    const snaps = getModuleSnapPoints('struct_arg_vertical_01_macro');
    const snap = snaps.find(s => s.name.toLowerCase() === snapName.toLowerCase());
    const g = new THREE.Group();
    g.rotation.order = 'YXZ';
    g.rotation.y = mod.rotation.yaw * Math.PI / 180;
    g.rotation.x = (mod.rotation.pitch + 180) * Math.PI / 180;
    g.rotation.z = (mod.rotation.roll + 180) * Math.PI / 180;
    g.position.set(mod.position.x, mod.position.y, -mod.position.z);
    const dot = new THREE.Vector3(-snap.pos[0], snap.pos[1], -snap.pos[2]);
    dot.applyEuler(g.rotation);
    dot.add(g.position);
    return dot;
  }

  function prongDir(mod) {
    const g = new THREE.Group();
    g.rotation.order = 'YXZ';
    g.rotation.y = mod.rotation.yaw * Math.PI / 180;
    g.rotation.x = (mod.rotation.pitch + 180) * Math.PI / 180;
    g.rotation.z = (mod.rotation.roll + 180) * Math.PI / 180;
    // In raw mesh, prongs are at +X (600), connector at -X (-200)
    // Under Rx(180) Rz(180), +X becomes -X, so prong vector in moduleGroup is (-1, 0, 0)
    return new THREE.Vector3(-1, 0, 0).applyEuler(g.rotation);
  }

  const s222 = worldSnap(p222, 'connectionsnap003');
  const s221 = worldSnapPred(pred221, 'connectionsnap002');
  const d222 = s222.distanceTo(s221);

  const s223 = worldSnap(p223, 'connectionsnap003');
  const s115 = worldSnapPred(pred115, 'connectionsnap002');
  const d223 = s223.distanceTo(s115);

  const dir222 = prongDir(p222);
  const dir223 = prongDir(p223);

  console.log(`Yaw Pier 222: ${yawPier222}° -> Snap distance to Pred 221: ${d222.toFixed(4)}m`);
  console.log(`   Prong Direction: (${dir222.x.toFixed(3)}, ${dir222.y.toFixed(3)}, ${dir222.z.toFixed(3)}) -> ${dir222.z < -0.9 ? 'POINTS SOUTH (INWARD)' : (dir222.z > 0.9 ? 'POINTS NORTH (OUTWARD)' : 'OTHER')}`);

  console.log(`Yaw Pier 223: ${yawPier223}° -> Snap distance to Pred 115: ${d223.toFixed(4)}m`);
  console.log(`   Prong Direction: (${dir223.x.toFixed(3)}, ${dir223.y.toFixed(3)}, ${dir223.z.toFixed(3)}) -> ${dir223.z > 0.9 ? 'POINTS NORTH (INWARD)' : (dir223.z < -0.9 ? 'POINTS SOUTH (OUTWARD)' : 'OTHER')}`);
}

console.log('=== BEFORE (current yaw in XML) ===');
checkSnap(90.084, -89.582);

console.log('\n=== AFTER (rotated 180° to point outward) ===');
checkSnap(-89.916, 90.418);

/**
 * Module metadata, classification, and procedural 3D graphics generator.
 */

// Colors for each module category
export const CATEGORY_COLORS = {
  docks: '#FF9F1C',       // Orange
  production: '#2EC4B6',  // Neon Teal
  storage: '#00B4D8',     // Bright Cyan/Blue
  habitation: '#9D4EDD',  // Purple
  defense: '#E63946',     // Red
  structure: '#8D99AE'    // Slate Grey
};

// Nice user-friendly names for categories
export const CATEGORY_NAMES = {
  docks: 'Docks',
  production: 'Production Factories',
  storage: 'Cargo Storage',
  habitation: 'Habitations (Crew)',
  defense: 'Defense Platforms',
  structure: 'Connection Structures'
};

// Material presets for procedural rendering
let materialsCache = null;

function createCustomBasicMaterial(THREE, params) {
  const color = params.color !== undefined ? params.color : 0xffffff;
  const opacity = params.opacity !== undefined ? params.opacity : 1.0;
  const transparent = params.transparent || false;
  
  const mat = new THREE.MeshBasicMaterial({
    color: color,
    opacity: opacity,
    transparent: transparent,
    side: params.side !== undefined ? params.side : THREE.FrontSide,
    toneMapped: false
  });

  // Attach emissive and emissiveIntensity to avoid standard Three.js webgl renderer null exceptions
  mat.emissive = new THREE.Color(params.emissive !== undefined ? params.emissive : 0x000000);
  mat.emissiveIntensity = params.emissiveIntensity !== undefined ? params.emissiveIntensity : 1.0;

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.emissive = { value: mat.emissive };
    shader.uniforms.emissiveIntensity = { value: mat.emissiveIntensity };

    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `#include <common>
       uniform vec3 emissive;
       uniform float emissiveIntensity;`
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
       uniform vec3 emissive;
       uniform float emissiveIntensity;`
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      `#include <opaque_fragment>
       gl_FragColor.rgb += emissive * emissiveIntensity;`
    );
  };

  return mat;
}

function initMaterials(THREE) {
  if (materialsCache) return materialsCache;

  materialsCache = {
    structure: createCustomBasicMaterial(THREE, {
      color: 0x4A5568
    }),
    structureDetail: createCustomBasicMaterial(THREE, {
      color: 0x1A202C
    }),
    dockDeck: createCustomBasicMaterial(THREE, {
      color: 0x2D3748
    }),
    solarPanel: createCustomBasicMaterial(THREE, {
      color: 0x0F4C81,
      emissive: 0x0A2A4A,
      emissiveIntensity: 0.5
    }),
    habitatGlass: createCustomBasicMaterial(THREE, {
      color: 0x9D4EDD,
      transparent: true,
      opacity: 0.4,
      emissive: 0x3C096C,
      emissiveIntensity: 0.8
    }),
    emissiveCyan: createCustomBasicMaterial(THREE, {
      color: 0x00F5FF,
      emissive: 0x00F5FF,
      emissiveIntensity: 2.0
    }),
    emissiveGreen: createCustomBasicMaterial(THREE, {
      color: 0x39FF14,
      emissive: 0x39FF14,
      emissiveIntensity: 2.0
    }),
    emissiveOrange: createCustomBasicMaterial(THREE, {
      color: 0xFF9F1C,
      emissive: 0xFF9F1C,
      emissiveIntensity: 1.5
    }),
    emissiveRed: createCustomBasicMaterial(THREE, {
      color: 0xFF3131,
      emissive: 0xFF3131,
      emissiveIntensity: 2.5
    }),
    wireframe: new THREE.MeshBasicMaterial({
      color: 0x8D99AE,
      wireframe: true,
      transparent: true,
      opacity: 0.3
    })
  };

  return materialsCache;
}

/**
 * Classify a macro name into one of the core categories
 */
export function getModuleCategory(macroName) {
  const name = macroName.toLowerCase();
  if (name.includes('dock') || name.includes('pier')) {
    return 'docks';
  } else if (name.includes('prod_') || name.includes('factory') || name.includes('farm') || name.includes('refined')) {
    return 'production';
  } else if (name.includes('storage') || name.includes('store') || name.includes('container') || name.includes('solid') || name.includes('liquid')) {
    return 'storage';
  } else if (name.includes('hab_') || name.includes('habitation') || name.includes('population') || name.includes('crew')) {
    return 'habitation';
  } else if (name.includes('defense') || name.includes('def_') || name.includes('disc') || name.includes('bridge_admin') || name.includes('platform_defence')) {
    return 'defense';
  } else {
    return 'structure';
  }
}

/**
 * Translate internal macro names into readable game-like titles
 */
export function getFriendlyName(macroName) {
  const parts = macroName.replace('_macro', '').split('_');
  
  // Format individual tokens
  const formattedParts = parts.map(part => {
    if (part === 'arg') return 'Argon';
    if (part === 'tel') return 'Teladi';
    if (part === 'par') return 'Paranid';
    if (part === 'spl') return 'Split';
    if (part === 'ter') return 'Terran';
    if (part === 'xen') return 'Xenon';
    if (part === 'gen') return 'General';
    if (part === 'prod') return 'Production:';
    if (part === 'hab') return 'Habitation';
    if (part === 'struct') return 'Structural';
    
    // Capitalize first letter
    return part.charAt(0).toUpperCase() + part.slice(1);
  });

  return formattedParts.join(' ');
}

/**
 * Generate mock resource construction costs for visual depth
 */
export function estimateModuleCosts(macroName) {
  const category = getModuleCategory(macroName);
  const name = macroName.toLowerCase();
  
  // Faction detection
  const isTerran = name.includes('_ter_');
  const isBoron = name.includes('_bor_');
  
  // Set scale based on module sizing
  const scale = name.includes('_l_') || name.includes('03') || name.includes('pier') ? 2.5 :
                name.includes('_m_') || name.includes('02') ? 1.5 : 1.0;

  // Initialize resources template
  const costs = {
    hullParts: 0,
    claytronics: 0,
    computronicSubstrate: 0,
    siliconCarbide: 0,
    metallicMicrolattice: 0,
    shieldComponents: 0,
    turretComponents: 0,
    advancedElectronics: 0,
    water: 0,
    energyCells: 0
  };

  // Base materials selection based on faction
  if (isTerran) {
    // Terran Protectorate modules
    const terranBase = {
      docks: { computronicSubstrate: 280, siliconCarbide: 450, metallicMicrolattice: 600, energyCells: 350 },
      production: { computronicSubstrate: 500, siliconCarbide: 800, metallicMicrolattice: 1100, energyCells: 600 },
      storage: { computronicSubstrate: 250, siliconCarbide: 380, metallicMicrolattice: 500, energyCells: 250 },
      habitation: { computronicSubstrate: 350, siliconCarbide: 550, metallicMicrolattice: 750, energyCells: 450 },
      defense: { computronicSubstrate: 400, siliconCarbide: 600, metallicMicrolattice: 850, energyCells: 400 },
      structure: { computronicSubstrate: 80, siliconCarbide: 120, metallicMicrolattice: 150, energyCells: 100 }
    };
    const c = terranBase[category];
    costs.computronicSubstrate = Math.round(c.computronicSubstrate * scale);
    costs.siliconCarbide = Math.round(c.siliconCarbide * scale);
    costs.metallicMicrolattice = Math.round(c.metallicMicrolattice * scale);
    costs.energyCells = Math.round(c.energyCells * scale);
  } else {
    // Commonwealth / Boron modules
    const commonBase = {
      docks: { hullParts: 1450, claytronics: 420, energyCells: 350 },
      production: { hullParts: 2800, claytronics: 850, energyCells: 600 },
      storage: { hullParts: 1200, claytronics: 320, energyCells: 250 },
      habitation: { hullParts: 1900, claytronics: 680, energyCells: 450 },
      defense: { hullParts: 2100, claytronics: 550, energyCells: 400 },
      structure: { hullParts: 450, claytronics: 120, energyCells: 100 }
    };
    const c = commonBase[category];
    costs.hullParts = Math.round(c.hullParts * scale);
    costs.claytronics = Math.round(c.claytronics * scale);
    costs.energyCells = Math.round(c.energyCells * scale);
    
    if (isBoron) {
      // Boron additionally requires Water
      costs.water = Math.round(150 * scale);
    }
  }

  // If defense platforms or habitats, add weapons and shields systems
  if (category === 'defense') {
    costs.shieldComponents = Math.round(250 * scale);
    costs.turretComponents = Math.round(300 * scale);
    costs.advancedElectronics = Math.round(120 * scale);
  } else if (category === 'docks' && scale > 1.5) {
    // Large piers/docks also have defensive turrets
    costs.shieldComponents = Math.round(100 * scale);
    costs.turretComponents = Math.round(120 * scale);
  }

  return costs;
}

/**
 * Procedurally generates a 3D visual object representing the macro
 */
export function createProceduralModule(macroName, THREE) {
  const materials = initMaterials(THREE);
  const category = getModuleCategory(macroName);
  const group = new THREE.Group();
  group.name = macroName;

  // Add a base connector ring (represented in all modules for visual continuity)
  const connectorGeo = new THREE.CylinderGeometry(15, 15, 10, 8);
  const connector = new THREE.Mesh(connectorGeo, materials.structureDetail);
  connector.rotation.x = Math.PI / 2;
  group.add(connector);

  // Determine size multiplier
  const sizeMult = macroName.includes('_l_') ? 1.5 : macroName.includes('_m_') ? 1.1 : 0.8;

  // Array of animatable parts to rotate/pulse in render loop
  const animations = [];

  switch (category) {
    case 'docks': {
      // 1. Central pier body
      const bodyGeo = new THREE.BoxGeometry(40 * sizeMult, 20 * sizeMult, 120 * sizeMult);
      const body = new THREE.Mesh(bodyGeo, materials.structure);
      body.position.z = 50 * sizeMult;
      group.add(body);

      // 2. Landing decks
      const numDecks = macroName.includes('_l_') || macroName.includes('pier') ? 3 : 1;
      for (let i = 0; i < numDecks; i++) {
        const deckGeo = new THREE.BoxGeometry(100 * sizeMult, 4 * sizeMult, 80 * sizeMult);
        const deck = new THREE.Mesh(deckGeo, materials.dockDeck);
        // Position decks sequentially
        deck.position.set(0, 8 * sizeMult, (30 + i * 45) * sizeMult);
        group.add(deck);

        // Landing strip centerline lights (small glowing green markers)
        for (let j = -30; j <= 30; j += 15) {
          const lightGeo = new THREE.SphereGeometry(1.5, 6, 6);
          const light = new THREE.Mesh(lightGeo, materials.emissiveGreen);
          light.position.set(0, 11 * sizeMult, (30 + i * 45 + j) * sizeMult);
          group.add(light);
        }
      }

      // 3. Control tower
      const towerGeo = new THREE.BoxGeometry(15 * sizeMult, 40 * sizeMult, 15 * sizeMult);
      const tower = new THREE.Mesh(towerGeo, materials.structureDetail);
      tower.position.set(20 * sizeMult, 25 * sizeMult, 40 * sizeMult);
      group.add(tower);

      const cabinGeo = new THREE.CylinderGeometry(12 * sizeMult, 10 * sizeMult, 12 * sizeMult, 6);
      const cabin = new THREE.Mesh(cabinGeo, materials.habitatGlass);
      cabin.position.set(20 * sizeMult, 45 * sizeMult, 40 * sizeMult);
      group.add(cabin);
      break;
    }

    case 'production': {
      // 1. Central factory core
      const coreGeo = new THREE.BoxGeometry(60 * sizeMult, 60 * sizeMult, 60 * sizeMult);
      const core = new THREE.Mesh(coreGeo, materials.structure);
      group.add(core);

      // 2. Solar Arrays (common for production)
      const arrayG = new THREE.Group();
      arrayG.position.set(0, 0, 0);

      const crossbarGeo = new THREE.CylinderGeometry(4, 4, 160 * sizeMult, 8);
      const crossbar = new THREE.Mesh(crossbarGeo, materials.structureDetail);
      crossbar.rotation.z = Math.PI / 2;
      arrayG.add(crossbar);

      // Left solar panel
      const panelLGeo = new THREE.BoxGeometry(60 * sizeMult, 2, 80 * sizeMult);
      const panelL = new THREE.Mesh(panelLGeo, materials.solarPanel);
      panelL.position.set(-80 * sizeMult, 0, 0);
      arrayG.add(panelL);

      // Right solar panel
      const panelRGeo = new THREE.BoxGeometry(60 * sizeMult, 2, 80 * sizeMult);
      const panelR = new THREE.Mesh(panelRGeo, materials.solarPanel);
      panelR.position.set(80 * sizeMult, 0, 0);
      arrayG.add(panelR);

      group.add(arrayG);
      
      // Animate solar panel tracking rotation
      animations.push((time) => {
        arrayG.rotation.y = time * 0.05;
      });

      // 3. Smoke/thermal vents (cylinders with glowing tips)
      for (let x = -15; x <= 15; x += 30) {
        for (let z = -15; z <= 15; z += 30) {
          const chimneyGeo = new THREE.CylinderGeometry(6, 6, 25 * sizeMult, 8);
          const chimney = new THREE.Mesh(chimneyGeo, materials.structureDetail);
          chimney.position.set(x * sizeMult, 40 * sizeMult, z * sizeMult);
          group.add(chimney);

          const glowGeo = new THREE.CylinderGeometry(5.8, 5.8, 2, 8);
          const glow = new THREE.Mesh(glowGeo, materials.emissiveCyan);
          glow.position.set(x * sizeMult, 53 * sizeMult, z * sizeMult);
          group.add(glow);
        }
      }
      break;
    }

    case 'storage': {
      // Storage displays multiple large tanks
      const tankHeight = 100 * sizeMult;
      const tankRadius = 20 * sizeMult;
      const numTanks = macroName.includes('_l_') ? 4 : macroName.includes('_m_') ? 3 : 1;

      if (numTanks === 1) {
        // Single large container
        const tankGeo = new THREE.CylinderGeometry(tankRadius * 1.2, tankRadius * 1.2, tankHeight, 12);
        const tank = new THREE.Mesh(tankGeo, materials.structure);
        tank.position.y = tankHeight / 2;
        group.add(tank);

        // Glowing cargo levels
        for (let h = 10; h < tankHeight; h += 25) {
          const bandGeo = new THREE.CylinderGeometry(tankRadius * 1.22, tankRadius * 1.22, 2, 12);
          const band = new THREE.Mesh(bandGeo, materials.emissiveCyan);
          band.position.y = h;
          group.add(band);
        }
      } else {
        // Multi-tank cluster (triangle or square configuration)
        const angles = numTanks === 4 ? [0, Math.PI/2, Math.PI, Math.PI*1.5] : [0, Math.PI*2/3, Math.PI*4/3];
        const offset = 22 * sizeMult;

        angles.forEach(angle => {
          const x = Math.cos(angle) * offset;
          const z = Math.sin(angle) * offset;

          const tankGeo = new THREE.CylinderGeometry(tankRadius, tankRadius, tankHeight, 10);
          const tank = new THREE.Mesh(tankGeo, materials.structure);
          tank.position.set(x, tankHeight / 2, z);
          group.add(tank);

          // Glowing caps/tops
          const capGeo = new THREE.SphereGeometry(tankRadius * 0.99, 10, 8, 0, Math.PI*2, 0, Math.PI/2);
          const cap = new THREE.Mesh(capGeo, materials.structureDetail);
          cap.position.set(x, tankHeight, z);
          group.add(cap);

          // Glowing state pipe
          const pipeGeo = new THREE.CylinderGeometry(2, 2, tankHeight - 10, 4);
          const pipe = new THREE.Mesh(pipeGeo, materials.emissiveCyan);
          pipe.position.set(x, tankHeight / 2, z + tankRadius + 1);
          group.add(pipe);
        });

        // Central support core
        const coreGeo = new THREE.CylinderGeometry(8 * sizeMult, 8 * sizeMult, tankHeight + 10, 8);
        const core = new THREE.Mesh(coreGeo, materials.structureDetail);
        core.position.y = (tankHeight + 10) / 2;
        group.add(core);
      }
      break;
    }

    case 'habitation': {
      // Habitation modules are large rotating torus structures (gravity rings)
      const axleGeo = new THREE.CylinderGeometry(15, 15, 80 * sizeMult, 12);
      const axle = new THREE.Mesh(axleGeo, materials.structureDetail);
      axle.rotation.x = Math.PI / 2;
      group.add(axle);

      const ringGroup = new THREE.Group();

      // Outer habitat ring
      const torusGeo = new THREE.TorusGeometry(80 * sizeMult, 15 * sizeMult, 12, 48);
      const torus = new THREE.Mesh(torusGeo, materials.structure);
      ringGroup.add(torus);

      // Glass windows on outer ring
      const windowTorusGeo = new THREE.TorusGeometry(80 * sizeMult, 15.5 * sizeMult, 8, 24, Math.PI / 3);
      for (let i = 0; i < Math.PI * 2; i += Math.PI / 2) {
        const windowMesh = new THREE.Mesh(windowTorusGeo, materials.habitatGlass);
        windowMesh.rotation.z = i;
        ringGroup.add(windowMesh);
      }

      // Connecting structural spokes
      const spokeCount = 6;
      for (let i = 0; i < spokeCount; i++) {
        const angle = (i / spokeCount) * Math.PI * 2;
        const spokeGeo = new THREE.CylinderGeometry(4, 4, 80 * sizeMult, 8);
        const spoke = new THREE.Mesh(spokeGeo, materials.structureDetail);
        spoke.position.set(Math.cos(angle) * 40 * sizeMult, Math.sin(angle) * 40 * sizeMult, 0);
        spoke.rotation.z = angle + Math.PI / 2;
        ringGroup.add(spoke);
      }

      group.add(ringGroup);

      // Slowly rotate the gravity habitat ring
      animations.push((time) => {
        ringGroup.rotation.z = time * 0.12;
      });
      break;
    }

    case 'defense': {
      // Defense discs or armed platforms
      // 1. Central thick armored disc
      const diskGeo = new THREE.CylinderGeometry(60 * sizeMult, 70 * sizeMult, 25 * sizeMult, 12);
      const disk = new THREE.Mesh(diskGeo, materials.structure);
      disk.rotation.x = Math.PI / 2;
      group.add(disk);

      // 2. Weapon platforms pointing in directions
      const turretPositions = [
        { angle: 0, height: 15 },
        { angle: Math.PI / 2, height: 15 },
        { angle: Math.PI, height: 15 },
        { angle: -Math.PI / 2, height: 15 }
      ];

      turretPositions.forEach((pos, idx) => {
        const angle = pos.angle;
        const dist = 55 * sizeMult;
        
        // Base mount
        const mountGeo = new THREE.BoxGeometry(20 * sizeMult, 15 * sizeMult, 20 * sizeMult);
        const mount = new THREE.Mesh(mountGeo, materials.structureDetail);
        mount.position.set(Math.cos(angle) * dist, Math.sin(angle) * dist, 0);
        mount.rotation.z = angle;
        group.add(mount);

        // Glowing laser emitter strip
        const glowGeo = new THREE.BoxGeometry(22 * sizeMult, 2, 2);
        const glow = new THREE.Mesh(glowGeo, materials.emissiveRed);
        glow.position.set(Math.cos(angle) * dist, Math.sin(angle) * dist, 8 * sizeMult);
        glow.rotation.z = angle;
        group.add(glow);

        // Turret gun barrels
        const barrelGeo = new THREE.CylinderGeometry(2, 2, 35 * sizeMult, 6);
        const barrel1 = new THREE.Mesh(barrelGeo, materials.structureDetail);
        barrel1.position.set(Math.cos(angle) * (dist + 15 * sizeMult) - Math.sin(angle) * 4, Math.sin(angle) * (dist + 15 * sizeMult) + Math.cos(angle) * 4, 4);
        barrel1.rotation.z = angle + Math.PI / 2;
        
        const barrel2 = new THREE.Mesh(barrelGeo, materials.structureDetail);
        barrel2.position.set(Math.cos(angle) * (dist + 15 * sizeMult) + Math.sin(angle) * 4, Math.sin(angle) * (dist + 15 * sizeMult) - Math.cos(angle) * 4, 4);
        barrel2.rotation.z = angle + Math.PI / 2;

        group.add(barrel1);
        group.add(barrel2);
      });

      // 3. Heavy Shield dome (top/bottom)
      const domeGeo = new THREE.SphereGeometry(25 * sizeMult, 12, 10, 0, Math.PI*2, 0, Math.PI/2);
      const domeT = new THREE.Mesh(domeGeo, materials.habitatGlass);
      domeT.position.z = 12 * sizeMult;
      domeT.rotation.x = Math.PI / 2;
      group.add(domeT);

      const domeB = new THREE.Mesh(domeGeo, materials.habitatGlass);
      domeB.position.z = -12 * sizeMult;
      domeB.rotation.x = -Math.PI / 2;
      group.add(domeB);
      break;
    }

    case 'structure':
    default: {
      // Connectors like straight, cross, turns
      const isCross = macroName.includes('cross');
      const isTurn = macroName.includes('turn') || macroName.includes('corner');
      const isTee = macroName.includes('_t_');

      if (isCross) {
        // Cross connector: central cube with 6 sticking tubes
        const coreGeo = new THREE.BoxGeometry(40 * sizeMult, 40 * sizeMult, 40 * sizeMult);
        const core = new THREE.Mesh(coreGeo, materials.structure);
        group.add(core);

        const tubeGeo = new THREE.CylinderGeometry(15, 15, 80 * sizeMult, 8);
        
        const tubeX = new THREE.Mesh(tubeGeo, materials.structureDetail);
        tubeX.rotation.z = Math.PI / 2;
        group.add(tubeX);

        const tubeY = new THREE.Mesh(tubeGeo, materials.structureDetail);
        group.add(tubeY);

        const tubeZ = new THREE.Mesh(tubeGeo, materials.structureDetail);
        tubeZ.rotation.x = Math.PI / 2;
        group.add(tubeZ);

        // Add some glowing neon lights at the junctions
        const rings = [
          { axis: 'x', pos: 35 * sizeMult },
          { axis: 'x', pos: -35 * sizeMult },
          { axis: 'y', pos: 35 * sizeMult },
          { axis: 'y', pos: -35 * sizeMult },
          { axis: 'z', pos: 35 * sizeMult },
          { axis: 'z', pos: -35 * sizeMult }
        ];

        rings.forEach(ring => {
          const ringGeo = new THREE.TorusGeometry(16, 2, 8, 16);
          const ringMesh = new THREE.Mesh(ringGeo, materials.emissiveOrange);
          
          if (ring.axis === 'x') {
            ringMesh.position.x = ring.pos;
            ringMesh.rotation.y = Math.PI / 2;
          } else if (ring.axis === 'y') {
            ringMesh.position.y = ring.pos;
            ringMesh.rotation.x = Math.PI / 2;
          } else {
            ringMesh.position.z = ring.pos;
          }
          group.add(ringMesh);
        });
      } else if (isTurn) {
        // Turn connector: bent tube
        const bendGeo = new THREE.TorusGeometry(30 * sizeMult, 15, 8, 16, Math.PI / 2);
        const bend = new THREE.Mesh(bendGeo, materials.structure);
        bend.position.set(-15 * sizeMult, -15 * sizeMult, 0);
        group.add(bend);

        // Flange elements at ends
        const flangeGeo = new THREE.CylinderGeometry(18, 18, 4, 8);
        
        const f1 = new THREE.Mesh(flangeGeo, materials.structureDetail);
        f1.position.set(-15 * sizeMult, 15 * sizeMult, 0);
        f1.rotation.x = Math.PI / 2;
        group.add(f1);

        const f2 = new THREE.Mesh(flangeGeo, materials.structureDetail);
        f2.position.set(15 * sizeMult, -15 * sizeMult, 0);
        f2.rotation.z = Math.PI / 2;
        group.add(f2);
      } else {
        // Simple straight girder/structure
        const tubeLength = 100 * sizeMult;
        const mainTubeGeo = new THREE.CylinderGeometry(15, 15, tubeLength, 8);
        const mainTube = new THREE.Mesh(mainTubeGeo, materials.structure);
        mainTube.rotation.x = Math.PI / 2;
        group.add(mainTube);

        // External truss framework (visual flair)
        const frameBoxGeo = new THREE.BoxGeometry(32 * sizeMult, 32 * sizeMult, tubeLength * 0.9);
        const frameBox = new THREE.Mesh(frameBoxGeo, materials.wireframe);
        group.add(frameBox);

        // Glowing energy lines running along the tube
        const lineGeo = new THREE.CylinderGeometry(1.5, 1.5, tubeLength, 4);
        
        const l1 = new THREE.Mesh(lineGeo, materials.emissiveOrange);
        l1.position.set(16 * sizeMult, 0, 0);
        l1.rotation.x = Math.PI / 2;
        group.add(l1);

        const l2 = new THREE.Mesh(lineGeo, materials.emissiveOrange);
        l2.position.set(-16 * sizeMult, 0, 0);
        l2.rotation.x = Math.PI / 2;
        group.add(l2);
      }
      break;
    }
  }

  // Attach the tick function so the viewer can run animations
  group.userData = {
    category,
    animations,
    update: (time) => {
      animations.forEach(anim => anim(time));
    }
  };

  return group;
}

import { IBlueprintExporterPort } from '@x4/application';

/**
 * Escapes characters for XML attribute values and text nodes.
 * @param {string} str 
 * @returns {string}
 */
export function escapeXml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Formats an XML string with clean, standardized indentation.
 * @param {string} xmlString
 * @returns {string}
 */
export function formatXmlString(xmlString) {
  let formatted = '';
  const lines = xmlString.replace(/>\s*</g, '>\n<').split('\n');
  let indent = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const isClosing = line.startsWith('</');
    const isSelfClosing = line.endsWith('/>') || Boolean(line.match(/\/\s*>$/));
    const isSpecial = line.startsWith('<?') || line.startsWith('<!');
    const isSingleLineTagWithContent = Boolean(line.match(/<([^\s>]+)[^>]*>.*<\/\1>/));

    if (isClosing) {
      indent = Math.max(0, indent - 1);
    }

    formatted += '  '.repeat(indent) + line + '\n';

    if (!isClosing && !isSelfClosing && !isSpecial && !isSingleLineTagWithContent) {
      indent++;
    }
  }

  return formatted.trim();
}

/**
 * Detects DLC requirements based on macro identifiers present in the plan.
 * @param {Array<{macro: string}>} modules
 * @returns {Array<string>} Array of <patch> XML strings
 */
export function detectDlcPatches(modules) {
  const macros = (modules || []).map(m => (m.macro || '').toLowerCase());
  const patches = [];

  const hasTerran = macros.some(m => m.includes('_ter_'));
  const hasSplit = macros.some(m => m.includes('_spl_'));
  const hasBoron = macros.some(m => m.includes('_bor_'));
  const hasPirate = macros.some(m => m.includes('_pir_') || m.includes('_rip_'));
  const hasTimelines = macros.some(m => m.includes('timelines'));

  if (hasTerran) {
    patches.push('<patch extension="ego_dlc_terran" version="900" name="Cradle of Humanity"/>');
  }
  if (hasSplit) {
    patches.push('<patch extension="ego_dlc_split" version="800" name="Split Vendetta"/>');
  }
  if (hasBoron) {
    patches.push('<patch extension="ego_dlc_boron" version="800" name="Kingdom End"/>');
  }
  if (hasPirate) {
    patches.push('<patch extension="ego_dlc_pirate" version="800" name="Tides of Avarice"/>');
  }
  if (hasTimelines) {
    patches.push('<patch extension="ego_dlc_timelines" version="800" name="Timelines"/>');
  }

  return patches;
}

let activeFefbModuleIndex = null;

export function setFefbModuleIndex(idx) {
  activeFefbModuleIndex = (typeof idx === 'number') ? idx : (idx !== null && idx !== undefined ? Number(idx) : null);
}

export function getFefbModuleIndex() {
  return activeFefbModuleIndex;
}

/**
 * Generates an X4 construction plan XML from station plan modules data.
 * Supports both signatures:
 *   - (planName, planData, options = {})
 *   - (planEntity, metadata = {})
 * 
 * @param {string|object} planOrName - Station plan name or plan entity/object
 * @param {object} [planDataOrMetadata] - Plan data object or metadata
 * @param {object} [options] - Optional configurations
 * @returns {string} Complete XML document string
 */
export function generatePlanXML(planOrName, planDataOrMetadata = {}, options = {}) {
  let planName = '';
  let planData = {};
  let opts = {};

  if (typeof planOrName === 'string') {
    planName = planOrName;
    planData = planDataOrMetadata || {};
    opts = options || {};
  } else if (planOrName && typeof planOrName === 'object') {
    planData = planOrName;
    opts = planDataOrMetadata || {};
    planName = opts.name || planData.name || 'Custom Station Plan';
  }

  const cleanName = (planName || (planData && planData.name) || 'Custom Station Plan').trim();
  const planId = opts.id || (planData && planData.id) || `player_${Math.floor(Date.now() / 1000)}`;
  const description = opts.description || (planData && planData.description) || 'Generated with X4 Station Visualizer';

  let modulesList = [];
  if (typeof planData.getModules === 'function') {
    modulesList = planData.getModules().map(m => m.toDto());
  } else if (opts.modules && Array.isArray(opts.modules)) {
    modulesList = opts.modules;
  } else if (planData.modules && Array.isArray(planData.modules)) {
    modulesList = planData.modules;
  }

  const fefbIndex = opts.fefbModuleIndex !== undefined
    ? opts.fefbModuleIndex
    : ((planData && planData.fefbModuleIndex !== undefined) ? planData.fefbModuleIndex : getFefbModuleIndex());

  // Determine the FEFB module and its XML entry index
  let fefbMod = null;
  let fefbXmlEntryIndex = null;
  if (fefbIndex !== undefined && fefbIndex !== null) {
    fefbMod = modulesList.find(m => m.index === fefbIndex);
    if (fefbMod) {
      const fefbIdxInList = modulesList.indexOf(fefbMod);
      fefbXmlEntryIndex = fefbMod.index !== undefined ? fefbMod.index : (fefbIdxInList + 1);
    } else {
      fefbXmlEntryIndex = fefbIndex;
    }
  }

  // Ensure modules are topologically sorted so every predecessor appears before its children (preventing forward references)
  const modMap = new Map();
  modulesList.forEach((m, idx) => {
    const entryIdx = m.index !== undefined ? m.index : (idx + 1);
    modMap.set(entryIdx, m);
  });

  const visited = new Set();
  const sortedModulesList = [];

  function visit(m) {
    const entryIdx = m.index !== undefined ? m.index : (modulesList.indexOf(m) + 1);
    if (visited.has(entryIdx)) return;
    visited.add(entryIdx);
    if (m.predecessor && m.predecessor.index !== undefined && modMap.has(m.predecessor.index)) {
      visit(modMap.get(m.predecessor.index));
    }
    sortedModulesList.push(m);
  }

  if (fefbMod) {
    visit(fefbMod);
  }
  for (const m of modulesList) {
    visit(m);
  }
  modulesList = sortedModulesList;

  const entriesXml = [];
  modulesList.forEach((mod, idx) => {
    const entryIndex = mod.index !== undefined ? mod.index : (idx + 1);
    const macro = mod.macro || '';
    if (!macro) return;

    const isFefb = fefbXmlEntryIndex !== null && (mod === fefbMod || entryIndex === fefbXmlEntryIndex);

    let connAttr = mod.connection ? ` connection="${escapeXml(mod.connection)}"` : '';
    let predecessorXml = '';

    if (mod.predecessor && mod.predecessor.index !== undefined && !isFefb) {
      const pConn = mod.predecessor.connection ? ` connection="${escapeXml(mod.predecessor.connection)}"` : '';
      predecessorXml = `\n      <predecessor index="${mod.predecessor.index}"${pConn}/>`;
    } else if (fefbXmlEntryIndex !== null && !isFefb) {
      if (!connAttr) {
        connAttr = ' connection="connectionsnap001"';
      }
      predecessorXml = `\n      <predecessor index="${fefbXmlEntryIndex}" connection="connectionsnap001"/>`;
    }

    const posX = typeof mod.position?.x === 'number' ? mod.position.x : 0;
    const posY = typeof mod.position?.y === 'number' ? mod.position.y : 0;
    const posZ = typeof mod.position?.z === 'number' ? mod.position.z : 0;

    const rotYaw = typeof mod.rotation?.yaw === 'number' ? mod.rotation.yaw : 0;
    const rotPitch = typeof mod.rotation?.pitch === 'number' ? mod.rotation.pitch : 0;
    const rotRoll = typeof mod.rotation?.roll === 'number' ? mod.rotation.roll : 0;

    const posAttrs = [];
    if (posX !== 0) posAttrs.push(`x="${posX}"`);
    if (posY !== 0) posAttrs.push(`y="${posY}"`);
    if (posZ !== 0) posAttrs.push(`z="${posZ}"`);
    const posAttrStr = posAttrs.length > 0 ? posAttrs.join(' ') : 'x="0" y="0" z="0"';

    const rotAttrs = [];
    if (rotYaw !== 0) rotAttrs.push(`yaw="${rotYaw}"`);
    if (rotPitch !== 0) rotAttrs.push(`pitch="${rotPitch}"`);
    if (rotRoll !== 0) rotAttrs.push(`roll="${rotRoll}"`);
    const rotXml = rotAttrs.length > 0 ? `\n        <rotation ${rotAttrs.join(' ')}/>` : '';

    entriesXml.push(
`    <entry index="${entryIndex}" macro="${escapeXml(macro)}"${connAttr}>${predecessorXml}
      <offset>
        <position ${posAttrStr}/>${rotXml}
      </offset>
    </entry>`
    );
  });

  const patches = detectDlcPatches(modulesList);
  let patchesXml = '';
  if (patches.length > 0) {
    patchesXml = `\n    <patches>\n      ${patches.join('\n      ')}\n    </patches>`;
  }

  const rawDoc = `<?xml version="1.0" encoding="UTF-8"?>
<plans>
  <plan id="${escapeXml(planId)}" name="${escapeXml(cleanName)}" description="${escapeXml(description)}">${patchesXml}
${entriesXml.join('\n')}
  </plan>
</plans>
`;

  return formatXmlString(rawDoc);
}

/**
 * Adapter implementing IBlueprintExporterPort for X4 Construction Plans.
 */
export class XmlBlueprintExporter extends IBlueprintExporterPort {
  /**
   * Export domain StationPlan to X4 XML format.
   * @param {object} plan
   * @param {object} [metadata]
   * @returns {string}
   */
  export(plan, metadata = {}) {
    return generatePlanXML(plan, metadata);
  }

  /**
   * Detect DLC requirements.
   * @param {object[]} modules
   * @returns {string[]}
   */
  detectDlcPatches(modules) {
    return detectDlcPatches(modules);
  }
}

/**
 * X4 Station Construction Plan (Blueprint) XML Exporter for GoogleAntiGravity
 * Modeled on C:\Users\Zeus\projects\x4-supply-matrix exporter implementation.
 */

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
 * 
 * @param {string} planName - User-specified station plan name
 * @param {Object} planData - Station plan data object containing modules
 * @param {Object} [options] - Optional configurations (e.g. updated viewer modules)
 * @returns {string} Complete XML document string
 */
export function generatePlanXML(planName, planData, options = {}) {
  const cleanName = (planName || (planData && planData.name) || 'Custom Station Plan').trim();
  const planId = options.id || (planData && planData.id) || `player_${Math.floor(Date.now() / 1000)}`;
  const description = options.description || (planData && planData.description) || 'Generated with X4 Station Visualizer';

  const modulesList = options.modules || (planData && planData.modules) || [];

  const fefbIndex = options.fefbModuleIndex !== undefined
    ? options.fefbModuleIndex
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

  const entriesXml = [];
  modulesList.forEach((mod, idx) => {
    const entryIndex = mod.index !== undefined ? mod.index : (idx + 1);
    const macro = mod.macro || '';
    if (!macro) return;

    const isFefb = fefbXmlEntryIndex !== null && (mod === fefbMod || entryIndex === fefbXmlEntryIndex);

    let connAttr = mod.connection ? ` connection="${escapeXml(mod.connection)}"` : '';
    let predecessorXml = '';

    if (fefbXmlEntryIndex !== null && !isFefb) {
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

    entriesXml.push(
`    <entry index="${entryIndex}" macro="${escapeXml(macro)}"${connAttr}>${predecessorXml}
      <offset>
        <position x="${posX}" y="${posY}" z="${posZ}"/>
        <rotation yaw="${rotYaw}" pitch="${rotPitch}" roll="${rotRoll}"/>
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
 * Initiates an HTML5 client-side file download of the given XML content.
 * @param {string} xmlContent - Raw XML string
 * @param {string} fileName - File name to save as (e.g. "MyStation.xml")
 */
export function downloadXMLFile(xmlContent, fileName) {
  const safeName = (fileName || 'station_plan.xml').trim().replace(/[<>:"/\\|?*]+/g, '_');
  const finalName = safeName.toLowerCase().endsWith('.xml') ? safeName : `${safeName}.xml`;
  const blob = new Blob([xmlContent], { type: 'application/xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = finalName;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Displays a modal dialog prompting the user to name the blueprint before exporting.
 * 
 * @param {Object} params
 * @param {string} params.defaultName - Initial blueprint name
 * @param {number} params.totalModules - Number of modules in plan
 * @param {Function} params.onSave - Callback receiving the confirmed blueprint name string
 */
export function showCreateBlueprintModal({ defaultName, totalModules, onSave }) {
  const existing = document.getElementById('createBpModalOverlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'createBpModalOverlay';
  overlay.className = 'no-bp-popup-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');

  overlay.innerHTML = `
    <div class="no-bp-popup-card create-bp-modal-card">
      <div class="create-bp-modal-header">
        <span class="create-bp-modal-icon">📐</span>
        <div class="create-bp-modal-titles">
          <h3>Save .XML Blueprint</h3>
          <span class="create-bp-modal-sub">${totalModules} station module${totalModules === 1 ? '' : 's'} in current plan</span>
        </div>
      </div>

      <p class="create-bp-modal-desc">
        Name your blueprint before generating the XML file. It will be formatted following the X4 station construction plan specification and saved to your device.
      </p>

      <div class="create-bp-input-group">
        <label for="createBpNameInput">Blueprint Name</label>
        <input
          type="text"
          id="createBpNameInput"
          value="${escapeXml(defaultName || 'Custom Station Plan')}"
          placeholder="e.g. Paranid Prime Mega Complex"
          autocomplete="off"
          spellcheck="false"
        />
      </div>

      <div class="create-bp-modal-actions">
        <button type="button" id="btnCancelCreateBp" class="btn btn-secondary btn-modal-cancel">
          Cancel
        </button>
        <button type="button" id="btnConfirmCreateBp" class="btn btn-success btn-create-bp btn-modal-confirm">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
          Save .XML Blueprint
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const input = document.getElementById('createBpNameInput');
  const btnCancel = document.getElementById('btnCancelCreateBp');
  const btnConfirm = document.getElementById('btnConfirmCreateBp');

  setTimeout(() => {
    if (input) {
      input.focus();
      input.select();
    }
  }, 50);

  const close = () => {
    overlay.remove();
    document.removeEventListener('keydown', handleKey);
  };

  const handleConfirm = () => {
    const rawVal = input ? input.value.trim() : '';
    const finalName = rawVal || defaultName || 'Custom Station Plan';
    close();
    if (typeof onSave === 'function') {
      onSave(finalName);
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleConfirm();
    }
  };

  document.addEventListener('keydown', handleKey);
  if (btnCancel) btnCancel.addEventListener('click', close);
  if (btnConfirm) btnConfirm.addEventListener('click', handleConfirm);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
}

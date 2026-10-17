/**
 * X4 Station Construction Plan (Blueprint) XML Exporter for GoogleAntiGravity
 * Re-exports XML logic from @x4/adapter-xml while providing UI modal and client file download.
 */
import {
  escapeXml,
  formatXmlString,
  detectDlcPatches,
  generatePlanXML,
  setFefbModuleIndex,
  getFefbModuleIndex
} from '@x4/adapter-xml';

export {
  escapeXml,
  formatXmlString,
  detectDlcPatches,
  generatePlanXML,
  setFefbModuleIndex,
  getFefbModuleIndex
};

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

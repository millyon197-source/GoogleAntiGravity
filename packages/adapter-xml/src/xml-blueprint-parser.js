import { StationPlan, StationModule, Vector3D, EulerRotation } from '@x4/domain';
import { IBlueprintParserPort } from '@x4/application';

/**
 * Convert an X4 quaternion (qx, qy, qz, qw) to Euler angles (yaw, pitch, roll) in degrees.
 * Uses X4's standard rotation sequence 'YXZ' (yaw around Y, pitch around X, roll around Z).
 * Pitch and roll are returned with the signs X4 uses in <rotation pitch="..." roll="..."/>
 * attributes, which are the opposite of rotations about +X and +Z, so quaternion and attribute
 * rotations mean the same thing (computeModuleGroupRotation undoes both negations).
 *
 * @param {number} qx
 * @param {number} qy
 * @param {number} qz
 * @param {number} qw
 * @returns {{ yaw: number, pitch: number, roll: number }}
 */
export function quaternionToEulerYXZ(qx, qy, qz, qw) {
  const len = Math.hypot(qx, qy, qz, qw) || 1;
  const x = qx / len;
  const y = qy / len;
  const z = qz / len;
  const w = qw / len;

  const m11 = 1 - 2 * (y * y + z * z);
  const m13 = 2 * (x * z + y * w);
  const m21 = 2 * (x * y + z * w);
  const m22 = 1 - 2 * (x * x + z * z);
  const m23 = 2 * (y * z - x * w);
  const m31 = 2 * (x * z - y * w);
  const m33 = 1 - 2 * (x * x + y * y);

  const clampVal = Math.max(-1, Math.min(1, -m23));
  const pitchRad = Math.asin(clampVal);

  let yawRad = 0;
  let rollRad = 0;

  if (Math.abs(m23) < 0.9999999) {
    yawRad = Math.atan2(m13, m33);
    rollRad = Math.atan2(m21, m22);
  } else {
    yawRad = Math.atan2(-m31, m11);
    rollRad = 0;
  }

  const radToDeg = 180 / Math.PI;
  return {
    yaw: yawRad * radToDeg,
    pitch: pitchRad ? -pitchRad * radToDeg : 0,
    roll: rollRad ? -rollRad * radToDeg : 0
  };
}

/**
 * Adapter implementing IBlueprintParserPort for X4 Construction Plans in XML format.
 */
export class XmlBlueprintParser extends IBlueprintParserPort {
  /**
   * Parse raw XML string into domain StationPlan entity.
   * @param {string} xmlString
   * @returns {StationPlan}
   */
  parse(xmlString) {
    const rawDto = parseConstructionPlan(xmlString);
    return StationPlan.fromDto(rawDto);
  }
}

/**
 * Fallback parser using regex when DOMParser is unavailable (e.g. Node.js environments).
 * @param {string} xmlString 
 * @returns {object}
 */
function parseConstructionPlanRegex(xmlString) {
  const planMatch = xmlString.match(/<plan\b([^>]*)>/i);
  if (!planMatch) {
    throw new Error('No <plan> element found in the XML');
  }
  const planAttrs = planMatch[1];
  const getId = planAttrs.match(/\bid="([^"]*)"/i);
  const getName = planAttrs.match(/\bname="([^"]*)"/i);
  const getDesc = planAttrs.match(/\bdescription="([^"]*)"/i);

  const planData = {
    id: getId ? getId[1] : 'unknown_plan',
    name: getName ? getName[1] : 'Unnamed Station Plan',
    description: getDesc ? getDesc[1] : 'No description provided',
    modules: []
  };

  const entryRegex = /<entry\b([^>]*?)(?:\/>|>([\s\S]*?)<\/entry>)/gi;
  let entryMatch;
  let fallbackIndex = 1;

  while ((entryMatch = entryRegex.exec(xmlString)) !== null) {
    const entryAttrs = entryMatch[1];
    const entryBody = entryMatch[2] || '';

    const idxMatch = entryAttrs.match(/\bindex="([^"]*)"/i);
    const macroMatch = entryAttrs.match(/\bmacro="([^"]*)"/i);
    const connMatch = entryAttrs.match(/\bconnection="([^"]*)"/i);

    if (!macroMatch) continue;

    const index = idxMatch ? parseInt(idxMatch[1], 10) : fallbackIndex;
    const macro = macroMatch[1];
    const connection = connMatch ? connMatch[1] : '';

    const posMatch = entryBody.match(/<position\b([^>]*)\/?>/i);
    let x = 0, y = 0, z = 0;
    if (posMatch) {
      const px = posMatch[1].match(/\bx="([^"]*)"/i);
      const py = posMatch[1].match(/\by="([^"]*)"/i);
      const pz = posMatch[1].match(/\bz="([^"]*)"/i);
      if (px) x = parseFloat(px[1]) || 0;
      if (py) y = parseFloat(py[1]) || 0;
      if (pz) z = parseFloat(pz[1]) || 0;
    }

    const rotMatch = entryBody.match(/<rotation\b([^>]*)\/?>/i);
    let yaw = 0, pitch = 0, roll = 0;
    let quat = null;
    if (rotMatch) {
      const ry = rotMatch[1].match(/\byaw="([^"]*)"/i);
      const rp = rotMatch[1].match(/\bpitch="([^"]*)"/i);
      const rr = rotMatch[1].match(/\broll="([^"]*)"/i);
      if (ry) yaw = parseFloat(ry[1]) || 0;
      if (rp) pitch = parseFloat(rp[1]) || 0;
      if (rr) roll = parseFloat(rr[1]) || 0;
    } else {
      const quatMatch = entryBody.match(/<quaternion\b([^>]*)\/?>/i);
      if (quatMatch) {
        const mx = quatMatch[1].match(/\bqx="([^"]*)"/i);
        const my = quatMatch[1].match(/\bqy="([^"]*)"/i);
        const mz = quatMatch[1].match(/\bqz="([^"]*)"/i);
        const mw = quatMatch[1].match(/\bqw="([^"]*)"/i);
        const qx = mx ? parseFloat(mx[1]) || 0 : 0;
        const qy = my ? parseFloat(my[1]) || 0 : 0;
        const qz = mz ? parseFloat(mz[1]) || 0 : 0;
        const qw = mw ? parseFloat(mw[1]) || 0 : 1;
        quat = { qx, qy, qz, qw };
        const euler = quaternionToEulerYXZ(qx, qy, qz, qw);
        yaw = euler.yaw;
        pitch = euler.pitch;
        roll = euler.roll;
      }
    }

    const predMatch = entryBody.match(/<predecessor\b([^>]*)\/?>/i);
    let predecessor = null;
    if (predMatch) {
      const pIdx = predMatch[1].match(/\bindex="([^"]*)"/i);
      const pConn = predMatch[1].match(/\bconnection="([^"]*)"/i);
      predecessor = {
        index: pIdx ? parseInt(pIdx[1], 10) : undefined,
        connection: pConn ? pConn[1] : ''
      };
    }

    planData.modules.push({
      index: isNaN(index) ? fallbackIndex : index,
      macro,
      connection,
      predecessor,
      position: { x, y, z },
      rotation: { yaw, pitch, roll },
      ...(quat ? { quaternion: quat } : {})
    });
    fallbackIndex++;
  }

  planData.modules.sort((a, b) => a.index - b.index);
  return planData;
}

/**
 * Parse an X4 station plan XML document into normalized plan data.
 * Backward compatible with existing tests and scripts.
 *
 * @param {string} xmlString Raw XML plan text.
 * @returns {{
 *   id: string,
 *   name: string,
 *   description: string,
 *   modules: Array<{
 *     index: number,
 *     macro: string,
 *     connection: string,
 *     position: { x: number, y: number, z: number },
 *     rotation: { yaw: number, pitch: number, roll: number }
 *   }>
 * }}
 */
export function parseConstructionPlan(xmlString) {
  if (typeof DOMParser === 'undefined') {
    return parseConstructionPlanRegex(xmlString);
  }

  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

    // Check for XML parsing errors
    const parseError = xmlDoc.getElementsByTagName('parsererror');
    if (parseError.length > 0) {
      throw new Error(parseError[0].textContent || 'XML parsing failed');
    }

    const planNode = xmlDoc.getElementsByTagName('plan')[0];
    if (!planNode) {
      throw new Error('No <plan> element found in the XML');
    }

    const planData = {
      id: planNode.getAttribute('id') || 'unknown_plan',
      name: planNode.getAttribute('name') || 'Unnamed Station Plan',
      description: planNode.getAttribute('description') || 'No description provided',
      modules: []
    };

    const entryNodes = planNode.getElementsByTagName('entry');
    for (let i = 0; i < entryNodes.length; i++) {
      const entry = entryNodes[i];
      const index = parseInt(entry.getAttribute('index'), 10);
      const macro = entry.getAttribute('macro');
      const connection = entry.getAttribute('connection') || '';

      if (!macro) continue;

      let posNode = entry.getElementsByTagName('position')[0];
      let rotNode = entry.getElementsByTagName('rotation')[0];
      let quatNode = entry.getElementsByTagName('quaternion')[0];

      if (!posNode || (!rotNode && !quatNode)) {
        const offsetNode = entry.getElementsByTagName('offset')[0];
        if (offsetNode) {
          if (!posNode) posNode = offsetNode.getElementsByTagName('position')[0];
          if (!rotNode) rotNode = offsetNode.getElementsByTagName('rotation')[0];
          if (!quatNode) quatNode = offsetNode.getElementsByTagName('quaternion')[0];
        }
      }

      const x = posNode ? parseFloat(posNode.getAttribute('x') || '0') : 0;
      const y = posNode ? parseFloat(posNode.getAttribute('y') || '0') : 0;
      const z = posNode ? parseFloat(posNode.getAttribute('z') || '0') : 0;

      let yaw = 0, pitch = 0, roll = 0;
      let quat = null;
      if (rotNode) {
        yaw = parseFloat(rotNode.getAttribute('yaw') || '0');
        pitch = parseFloat(rotNode.getAttribute('pitch') || '0');
        roll = parseFloat(rotNode.getAttribute('roll') || '0');
      } else if (quatNode) {
        const qx = parseFloat(quatNode.getAttribute('qx') || '0');
        const qy = parseFloat(quatNode.getAttribute('qy') || '0');
        const qz = parseFloat(quatNode.getAttribute('qz') || '0');
        const qw = parseFloat(quatNode.getAttribute('qw') || '1');
        quat = { qx, qy, qz, qw };
        const euler = quaternionToEulerYXZ(qx, qy, qz, qw);
        yaw = euler.yaw;
        pitch = euler.pitch;
        roll = euler.roll;
      }

      const predNode = entry.getElementsByTagName('predecessor')[0];
      let predecessor = null;
      if (predNode) {
        predecessor = {
          index: parseInt(predNode.getAttribute('index'), 10),
          connection: predNode.getAttribute('connection') || ''
        };
      }

      planData.modules.push({
        index: isNaN(index) ? (i + 1) : index,
        macro: macro,
        connection: connection,
        predecessor: predecessor,
        position: { x, y, z },
        rotation: { yaw, pitch, roll },
        ...(quat ? { quaternion: quat } : {})
      });
    }

    planData.modules.sort((a, b) => a.index - b.index);
    return planData;
  } catch (error) {
    console.error('Error parsing XML plan:', error);
    throw new Error('Failed to parse XML plan: ' + error.message);
  }
}

/**
 * Parser for X4: Foundations Station Construction Plans (XML format).
 */

export function parseConstructionPlan(xmlString) {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

    // Check for XML parsing errors
    const parseError = xmlDoc.getElementsByTagName('parsererror');
    if (parseError.length > 0) {
      throw new Error(parseError[0].textContent || 'XML parsing failed');
    }

    const plansNode = xmlDoc.getElementsByTagName('plans')[0];
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

      if (!macro) continue; // Skip invalid entries without macro names

      // Position and Rotation might be direct children or nested under <offset>
      let posNode = entry.getElementsByTagName('position')[0];
      let rotNode = entry.getElementsByTagName('rotation')[0];

      // If not found in entry directly, check under <offset>
      if (!posNode || !rotNode) {
        const offsetNode = entry.getElementsByTagName('offset')[0];
        if (offsetNode) {
          if (!posNode) posNode = offsetNode.getElementsByTagName('position')[0];
          if (!rotNode) rotNode = offsetNode.getElementsByTagName('rotation')[0];
        }
      }

      // Read position values
      const x = posNode ? parseFloat(posNode.getAttribute('x') || '0') : 0;
      const y = posNode ? parseFloat(posNode.getAttribute('y') || '0') : 0;
      const z = posNode ? parseFloat(posNode.getAttribute('z') || '0') : 0;

      // Read rotation values (yaw, pitch, roll in degrees)
      const yaw = rotNode ? parseFloat(rotNode.getAttribute('yaw') || '0') : 0;
      const pitch = rotNode ? parseFloat(rotNode.getAttribute('pitch') || '0') : 0;
      const roll = rotNode ? parseFloat(rotNode.getAttribute('roll') || '0') : 0;

      planData.modules.push({
        index: isNaN(index) ? (i + 1) : index,
        macro: macro,
        connection: connection,
        position: { x, y, z },
        rotation: { yaw, pitch, roll }
      });
    }

    // Sort modules by index to respect the builder construction order
    planData.modules.sort((a, b) => a.index - b.index);

    return planData;
  } catch (error) {
    console.error('Error parsing XML plan:', error);
    throw new Error('Failed to parse XML plan: ' + error.message);
  }
}

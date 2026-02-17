'use strict';

const path = require('path');
const MoquiClient = require('./moqui-client');
const { loadAdapterConfig, validateAdapterConfig } = require('./moqui-adapter');

// ─── Constants ─────────────────────────────────────────────────────

const SUPPORTED_PATTERNS = ['crud', 'query', 'workflow'];

const HEADER_ITEM_SUFFIXES = [
  { header: 'Header', item: 'Item' },
  { header: 'Header', item: 'Detail' },
  { header: 'Master', item: 'Detail' }
];

const SCENE_API_VERSION = 'kse.scene/v0.2';
const PACKAGE_API_VERSION = 'kse.scene.package/v0.1';

// ─── YAML Serializer ──────────────────────────────────────────────

/**
 * Check if a string value needs quoting in YAML.
 * Quotes are needed for: empty strings, strings containing special chars,
 * strings that look like booleans or numbers, strings with leading/trailing spaces.
 * @param {string} value - String value to check
 * @returns {boolean} true if quoting is needed
 */
function needsYamlQuoting(value) {
  if (value === '') {
    return true;
  }

  // Leading or trailing whitespace
  if (value !== value.trim()) {
    return true;
  }

  // Looks like a boolean
  if (value === 'true' || value === 'false' || value === 'null' ||
      value === 'True' || value === 'False' || value === 'Null' ||
      value === 'TRUE' || value === 'FALSE' || value === 'NULL' ||
      value === 'yes' || value === 'no' || value === 'on' || value === 'off' ||
      value === 'Yes' || value === 'No' || value === 'On' || value === 'Off' ||
      value === 'YES' || value === 'NO' || value === 'ON' || value === 'OFF') {
    return true;
  }

  // Looks like a number
  if (/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(value)) {
    return true;
  }

  // Contains special YAML characters that could cause parsing issues
  if (/[:#\[\]{}&*!|>'"%@`]/.test(value)) {
    return true;
  }

  // Starts with special characters
  if (/^[-?](\s|$)/.test(value)) {
    return true;
  }

  return false;
}

/**
 * Format a scalar value for YAML output.
 * @param {*} value - Value to format
 * @returns {string} Formatted YAML value
 */
function formatYamlValue(value) {
  if (value === null || value === undefined) {
    return 'null';
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  if (typeof value === 'number') {
    return String(value);
  }

  const str = String(value);

  if (needsYamlQuoting(str)) {
    // Use double quotes and escape special characters
    const escaped = str
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
    return `"${escaped}"`;
  }

  return str;
}

/**
 * Serialize a scene manifest object to YAML string.
 * Uses a minimal built-in serializer (no external deps).
 * Handles nested objects, arrays, string/number/boolean values with 2-space indentation.
 * @param {Object} manifest - Scene manifest object
 * @returns {string} YAML string
 */
function serializeManifestToYaml(manifest) {
  if (manifest === null || manifest === undefined) {
    return 'null\n';
  }

  if (typeof manifest !== 'object') {
    return formatYamlValue(manifest) + '\n';
  }

  const lines = [];
  serializeObject(manifest, 0, lines);
  return lines.join('\n') + '\n';
}

/**
 * Serialize an object into YAML lines at the given indentation level.
 * @param {Object} obj - Object to serialize
 * @param {number} indent - Current indentation level (number of spaces)
 * @param {string[]} lines - Output lines array
 */
function serializeObject(obj, indent, lines) {
  const prefix = ' '.repeat(indent);
  const keys = Object.keys(obj);

  for (const key of keys) {
    const value = obj[key];
    serializeKeyValue(key, value, indent, prefix, lines);
  }
}

/**
 * Serialize a key-value pair into YAML lines.
 * @param {string} key - Object key
 * @param {*} value - Value to serialize
 * @param {number} indent - Current indentation level
 * @param {string} prefix - Indentation string
 * @param {string[]} lines - Output lines array
 */
function serializeKeyValue(key, value, indent, prefix, lines) {
  if (value === null || value === undefined) {
    lines.push(`${prefix}${key}: null`);
    return;
  }

  if (typeof value !== 'object') {
    // Scalar value
    lines.push(`${prefix}${key}: ${formatYamlValue(value)}`);
    return;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      lines.push(`${prefix}${key}: []`);
      return;
    }

    lines.push(`${prefix}${key}:`);
    serializeArray(value, indent + 2, lines);
    return;
  }

  // Nested object
  if (Object.keys(value).length === 0) {
    lines.push(`${prefix}${key}: {}`);
    return;
  }

  lines.push(`${prefix}${key}:`);
  serializeObject(value, indent + 2, lines);
}

/**
 * Serialize an array into YAML lines.
 * @param {Array} arr - Array to serialize
 * @param {number} indent - Current indentation level
 * @param {string[]} lines - Output lines array
 */
function serializeArray(arr, indent, lines) {
  const prefix = ' '.repeat(indent);

  for (const item of arr) {
    if (item === null || item === undefined) {
      lines.push(`${prefix}- null`);
      continue;
    }

    if (typeof item !== 'object') {
      // Scalar array item
      lines.push(`${prefix}- ${formatYamlValue(item)}`);
      continue;
    }

    if (Array.isArray(item)) {
      // Nested array — serialize as block under "- "
      lines.push(`${prefix}-`);
      serializeArray(item, indent + 2, lines);
      continue;
    }

    // Object array item — first key on same line as "- ", rest indented
    const keys = Object.keys(item);

    if (keys.length === 0) {
      lines.push(`${prefix}- {}`);
      continue;
    }

    const firstKey = keys[0];
    const firstValue = item[firstKey];

    if (firstValue !== null && firstValue !== undefined && typeof firstValue === 'object') {
      // First value is complex — put key on "- " line, value below
      if (Array.isArray(firstValue)) {
        if (firstValue.length === 0) {
          lines.push(`${prefix}- ${firstKey}: []`);
        } else {
          lines.push(`${prefix}- ${firstKey}:`);
          serializeArray(firstValue, indent + 4, lines);
        }
      } else {
        if (Object.keys(firstValue).length === 0) {
          lines.push(`${prefix}- ${firstKey}: {}`);
        } else {
          lines.push(`${prefix}- ${firstKey}:`);
          serializeObject(firstValue, indent + 4, lines);
        }
      }
    } else {
      // First value is scalar — put on same line as "- "
      lines.push(`${prefix}- ${firstKey}: ${formatYamlValue(firstValue)}`);
    }

    // Remaining keys indented to align with first key
    for (let i = 1; i < keys.length; i++) {
      const k = keys[i];
      const v = item[k];
      serializeKeyValue(k, v, indent + 2, ' '.repeat(indent + 2), lines);
    }
  }
}

// ─── YAML Parser ──────────────────────────────────────────────────

/**
 * Parse a YAML string back into an object.
 * Handles the subset of YAML used by scene manifests:
 * indentation-based nesting, "- " array items, key: value pairs,
 * boolean (true/false), number, and string values.
 * @param {string} yamlString - YAML content
 * @returns {Object} Parsed object
 */
function parseYaml(yamlString) {
  if (!yamlString || typeof yamlString !== 'string') {
    return {};
  }

  const trimmed = yamlString.trim();

  if (!trimmed) {
    return {};
  }

  if (trimmed === 'null') {
    return null;
  }

  // Split into lines, preserving empty lines for structure
  const rawLines = trimmed.split('\n');

  // Filter out empty lines and comment lines, but keep track of indentation
  const lines = [];

  for (const raw of rawLines) {
    // Skip empty lines and comment-only lines
    if (raw.trim() === '' || raw.trim().startsWith('#')) {
      continue;
    }

    lines.push(raw);
  }

  if (lines.length === 0) {
    return {};
  }

  // Check if the first line is a scalar value (no colon, no dash)
  const firstLine = lines[0].trim();

  if (lines.length === 1 && !firstLine.includes(':') && !firstLine.startsWith('-')) {
    return parseScalarValue(firstLine);
  }

  const result = parseBlock(lines, 0, lines.length, 0);

  return result.value;
}

/**
 * Parse a block of YAML lines into a value (object or array).
 * @param {string[]} lines - All lines
 * @param {number} start - Start index (inclusive)
 * @param {number} end - End index (exclusive)
 * @param {number} expectedIndent - Expected indentation level
 * @returns {{ value: Object|Array }}
 */
function parseBlock(lines, start, end, expectedIndent) {
  if (start >= end) {
    return { value: {} };
  }

  const firstLine = lines[start];
  const firstContent = firstLine.trimStart();

  // Determine if this block is an array or object
  if (firstContent.startsWith('- ') || firstContent === '-') {
    return { value: parseArrayBlock(lines, start, end, expectedIndent) };
  }

  return { value: parseObjectBlock(lines, start, end, expectedIndent) };
}

/**
 * Get the indentation level of a line (number of leading spaces).
 * @param {string} line - Input line
 * @returns {number} Number of leading spaces
 */
function getIndent(line) {
  let count = 0;

  for (let i = 0; i < line.length; i++) {
    if (line[i] === ' ') {
      count++;
    } else {
      break;
    }
  }

  return count;
}

/**
 * Parse a block of lines as an object.
 * @param {string[]} lines - All lines
 * @param {number} start - Start index
 * @param {number} end - End index
 * @param {number} baseIndent - Base indentation level
 * @returns {Object}
 */
function parseObjectBlock(lines, start, end, baseIndent) {
  const result = {};
  let i = start;

  while (i < end) {
    const line = lines[i];
    const indent = getIndent(line);

    // Skip lines with deeper indentation (they belong to a previous key)
    if (indent < baseIndent) {
      break;
    }

    const content = line.trimStart();

    // Skip if this is an array item at this level
    if (content.startsWith('- ') || content === '-') {
      i++;
      continue;
    }

    const colonIdx = content.indexOf(':');

    if (colonIdx === -1) {
      i++;
      continue;
    }

    const key = content.substring(0, colonIdx).trim();
    const afterColon = content.substring(colonIdx + 1).trim();

    if (afterColon === '' || afterColon === '') {
      // Value is on subsequent lines (nested block)
      const childIndent = findChildIndent(lines, i + 1, end);

      if (childIndent > indent) {
        const childEnd = findBlockEnd(lines, i + 1, end, childIndent);
        const child = parseBlock(lines, i + 1, childEnd, childIndent);
        result[key] = child.value;
        i = childEnd;
      } else {
        // Empty value — treat as null
        result[key] = null;
        i++;
      }
    } else if (afterColon === '[]') {
      result[key] = [];
      i++;
    } else if (afterColon === '{}') {
      result[key] = {};
      i++;
    } else {
      // Inline scalar value
      result[key] = parseScalarValue(afterColon);
      i++;
    }
  }

  return result;
}

/**
 * Parse a block of lines as an array.
 * @param {string[]} lines - All lines
 * @param {number} start - Start index
 * @param {number} end - End index
 * @param {number} baseIndent - Base indentation level
 * @returns {Array}
 */
function parseArrayBlock(lines, start, end, baseIndent) {
  const result = [];
  let i = start;

  while (i < end) {
    const line = lines[i];
    const indent = getIndent(line);

    if (indent < baseIndent) {
      break;
    }

    const content = line.trimStart();

    if (!content.startsWith('- ') && content !== '-') {
      i++;
      continue;
    }

    if (content === '-') {
      // Bare dash — value is on subsequent lines
      const childIndent = findChildIndent(lines, i + 1, end);

      if (childIndent > indent) {
        const childEnd = findBlockEnd(lines, i + 1, end, childIndent);
        const child = parseBlock(lines, i + 1, childEnd, childIndent);
        result.push(child.value);
        i = childEnd;
      } else {
        result.push(null);
        i++;
      }

      continue;
    }

    // "- " prefix — extract the content after "- "
    const itemContent = content.substring(2);

    if (itemContent === '[]') {
      result.push([]);
      i++;
      continue;
    }

    if (itemContent === '{}') {
      result.push({});
      i++;
      continue;
    }

    // Check if item content has a colon (it's an object entry)
    const colonIdx = itemContent.indexOf(':');

    if (colonIdx !== -1) {
      // This is an object item in the array
      // Parse the first key-value, then look for more keys at indent+2
      const firstKey = itemContent.substring(0, colonIdx).trim();
      const afterColon = itemContent.substring(colonIdx + 1).trim();

      const obj = {};

      if (afterColon === '') {
        // Value is on subsequent lines
        const valueIndent = findChildIndent(lines, i + 1, end);

        if (valueIndent > indent + 2) {
          const valueEnd = findBlockEnd(lines, i + 1, end, valueIndent);
          const child = parseBlock(lines, i + 1, valueEnd, valueIndent);
          obj[firstKey] = child.value;
          i = valueEnd;
        } else if (valueIndent === indent + 2) {
          // Could be the value block or sibling keys
          // Check if next line is a key at indent+2 or deeper content
          const nextContent = lines[i + 1] ? lines[i + 1].trimStart() : '';
          const nextIndent = lines[i + 1] ? getIndent(lines[i + 1]) : 0;

          if (nextIndent > indent + 2) {
            // Deeper content — it's the value
            const valueEnd = findBlockEnd(lines, i + 1, end, nextIndent);
            const child = parseBlock(lines, i + 1, valueEnd, nextIndent);
            obj[firstKey] = child.value;
            i = valueEnd;
          } else {
            // Same level as sibling keys — value is null, parse siblings
            obj[firstKey] = null;
            i++;
          }
        } else {
          obj[firstKey] = null;
          i++;
        }
      } else if (afterColon === '[]') {
        obj[firstKey] = [];
        i++;
      } else if (afterColon === '{}') {
        obj[firstKey] = {};
        i++;
      } else {
        obj[firstKey] = parseScalarValue(afterColon);
        i++;
      }

      // Parse remaining keys at indent+2
      const siblingIndent = indent + 2;

      while (i < end) {
        const sibLine = lines[i];
        const sibIndent = getIndent(sibLine);

        if (sibIndent < siblingIndent) {
          break;
        }

        if (sibIndent > siblingIndent) {
          // This belongs to a previous key's value — skip
          i++;
          continue;
        }

        const sibContent = sibLine.trimStart();

        // If it's a new array item at the base indent, stop
        if (sibContent.startsWith('- ') && sibIndent === baseIndent) {
          break;
        }

        const sibColonIdx = sibContent.indexOf(':');

        if (sibColonIdx === -1) {
          i++;
          continue;
        }

        const sibKey = sibContent.substring(0, sibColonIdx).trim();
        const sibAfterColon = sibContent.substring(sibColonIdx + 1).trim();

        if (sibAfterColon === '') {
          const childIndent = findChildIndent(lines, i + 1, end);

          if (childIndent > siblingIndent) {
            const childEnd = findBlockEnd(lines, i + 1, end, childIndent);
            const child = parseBlock(lines, i + 1, childEnd, childIndent);
            obj[sibKey] = child.value;
            i = childEnd;
          } else {
            obj[sibKey] = null;
            i++;
          }
        } else if (sibAfterColon === '[]') {
          obj[sibKey] = [];
          i++;
        } else if (sibAfterColon === '{}') {
          obj[sibKey] = {};
          i++;
        } else {
          obj[sibKey] = parseScalarValue(sibAfterColon);
          i++;
        }
      }

      result.push(obj);
    } else {
      // Scalar array item
      result.push(parseScalarValue(itemContent));
      i++;
    }
  }

  return result;
}

/**
 * Find the indentation level of the first non-empty child line.
 * @param {string[]} lines - All lines
 * @param {number} start - Start index
 * @param {number} end - End index
 * @returns {number} Child indentation level, or -1 if no child found
 */
function findChildIndent(lines, start, end) {
  for (let i = start; i < end; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed === '' || trimmed.startsWith('#')) {
      continue;
    }

    return getIndent(line);
  }

  return -1;
}

/**
 * Find the end index of a block at the given indentation level.
 * @param {string[]} lines - All lines
 * @param {number} start - Start index
 * @param {number} end - End index
 * @param {number} blockIndent - Block indentation level
 * @returns {number} End index (exclusive)
 */
function findBlockEnd(lines, start, end, blockIndent) {
  for (let i = start; i < end; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed === '' || trimmed.startsWith('#')) {
      continue;
    }

    const indent = getIndent(line);

    if (indent < blockIndent) {
      return i;
    }
  }

  return end;
}

/**
 * Parse a scalar YAML value string into a JavaScript value.
 * Handles: booleans, numbers, null, quoted strings, unquoted strings.
 * @param {string} value - Raw value string
 * @returns {*} Parsed value
 */
function parseScalarValue(value) {
  if (value === 'null' || value === 'Null' || value === 'NULL' || value === '~') {
    return null;
  }

  if (value === 'true' || value === 'True' || value === 'TRUE') {
    return true;
  }

  if (value === 'false' || value === 'False' || value === 'FALSE') {
    return false;
  }

  // Quoted string (double quotes)
  if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
    const inner = value.slice(1, -1);
    return inner
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\');
  }

  // Quoted string (single quotes)
  if (value.startsWith("'") && value.endsWith("'") && value.length >= 2) {
    return value.slice(1, -1).replace(/''/g, "'");
  }

  // Number
  if (/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(value)) {
    const num = Number(value);

    if (!isNaN(num) && isFinite(num)) {
      return num;
    }
  }

  return value;
}

// ─── PascalCase to kebab-case ──────────────────────────────────────

/**
 * Convert a PascalCase or camelCase string to kebab-case.
 * E.g., "OrderHeader" → "order-header", "Order" → "order",
 * "HTMLParser" → "html-parser", "myValue" → "my-value"
 * @param {string} str - PascalCase/camelCase string
 * @returns {string} kebab-case string
 */
function toKebabCase(str) {
  if (!str || typeof str !== 'string') {
    return '';
  }

  // Insert hyphen before uppercase letters that follow lowercase letters or
  // before an uppercase letter followed by a lowercase letter in a run of uppercase
  return str
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

// ─── Entity Grouping ──────────────────────────────────────────────

/**
 * Group related entities by header/item suffix patterns.
 * E.g., OrderHeader + OrderItem → { base: 'Order', entities: ['OrderHeader', 'OrderItem'], isComposite: true }
 * Entities without any suffix match are placed in their own group with isComposite: false.
 * Every input entity appears in exactly one group.
 * @param {string[]} entityNames - List of entity names
 * @returns {EntityGroup[]}
 */
function groupRelatedEntities(entityNames) {
  if (!Array.isArray(entityNames) || entityNames.length === 0) {
    return [];
  }

  // Track which entities have been assigned to a group
  const assigned = new Set();
  const groups = [];

  // First pass: find header/item pairs using HEADER_ITEM_SUFFIXES
  for (const suffixPair of HEADER_ITEM_SUFFIXES) {
    // Find all entities ending with the header suffix
    for (const entity of entityNames) {
      if (assigned.has(entity)) {
        continue;
      }

      if (!entity.endsWith(suffixPair.header)) {
        continue;
      }

      const base = entity.substring(0, entity.length - suffixPair.header.length);

      if (!base) {
        continue; // Skip if the entity name IS the suffix (e.g., "Header")
      }

      // Look for matching item entity
      const itemEntity = base + suffixPair.item;

      if (entityNames.includes(itemEntity) && !assigned.has(itemEntity)) {
        // Found a header/item pair
        const groupEntities = [entity, itemEntity];
        assigned.add(entity);
        assigned.add(itemEntity);

        groups.push({
          base,
          entities: groupEntities,
          isComposite: true
        });
      }
    }
  }

  // Second pass: assign remaining entities to their own groups
  for (const entity of entityNames) {
    if (assigned.has(entity)) {
      continue;
    }

    assigned.add(entity);
    groups.push({
      base: entity,
      entities: [entity],
      isComposite: false
    });
  }

  return groups;
}

// ─── Bundle and Package Name Derivation ───────────────────────────

/**
 * Derive a bundle directory name from pattern and resource.
 * Returns kebab-case string like "crud-order".
 * @param {PatternMatch} match - Pattern match
 * @returns {string} Directory name in kebab-case
 */
function deriveBundleDirName(match) {
  if (!match || !match.pattern || !match.primaryResource) {
    return '';
  }

  const pattern = match.pattern.toLowerCase();
  const resource = toKebabCase(match.primaryResource);

  return `${pattern}-${resource}`;
}

/**
 * Derive a package name from pattern and resource.
 * Returns kebab-case string like "crud-order".
 * @param {PatternMatch} match - Pattern match
 * @returns {string} Package name in kebab-case
 */
function derivePackageName(match) {
  if (!match || !match.pattern || !match.primaryResource) {
    return '';
  }

  const pattern = match.pattern.toLowerCase();
  const resource = toKebabCase(match.primaryResource);

  return `${pattern}-${resource}`;
}

// ─── Pattern Matching ─────────────────────────────────────────────

/**
 * Derive the idempotency key from an entity name.
 * Converts the entity name to a camelCase ID field.
 * E.g., "OrderHeader" → "orderId", "Product" → "productId"
 * @param {string} entityName - Entity name (PascalCase)
 * @returns {string} Idempotency key
 */
function deriveIdempotencyKey(entityName) {
  if (!entityName || typeof entityName !== 'string') {
    return '';
  }

  // Use the base name (strip common suffixes like Header, Item, Detail, Master)
  let base = entityName;

  for (const suffixPair of HEADER_ITEM_SUFFIXES) {
    if (base.endsWith(suffixPair.header)) {
      base = base.substring(0, base.length - suffixPair.header.length);
      break;
    }

    if (base.endsWith(suffixPair.item)) {
      base = base.substring(0, base.length - suffixPair.item.length);
      break;
    }
  }

  // If stripping left nothing, use original
  if (!base) {
    base = entityName;
  }

  // Convert to camelCase + "Id"
  const camel = base.charAt(0).toLowerCase() + base.slice(1);

  return camel + 'Id';
}

/**
 * Generate model scope entries for an entity.
 * Read scope includes entityId and statusId fields.
 * Write scope includes statusId field (for crud patterns).
 * @param {string} primaryEntity - Primary entity name
 * @param {string} pattern - Pattern type ('crud' | 'query')
 * @returns {{ read: string[], write: string[] }}
 */
function generateEntityModelScope(primaryEntity, pattern) {
  const idKey = deriveIdempotencyKey(primaryEntity);
  const read = [
    `moqui.${primaryEntity}.${idKey}`,
    `moqui.${primaryEntity}.statusId`
  ];

  const write = pattern === 'crud'
    ? [`moqui.${primaryEntity}.statusId`]
    : [];

  return { read, write };
}

/**
 * Match an entity group against pattern rules.
 * If the entity group has related services (services containing the entity base name),
 * classify as "crud". Otherwise, classify as "query" (read-only).
 *
 * @param {EntityGroup} group - Grouped entity info { base, entities, isComposite }
 * @param {string[]} services - Available service names
 * @returns {PatternMatch|null}
 */
function matchEntityPattern(group, services) {
  if (!group || !group.base || !Array.isArray(group.entities) || group.entities.length === 0) {
    return null;
  }

  services = Array.isArray(services) ? services : [];

  // Determine the primary entity (first entity in the group, typically the header entity)
  const primaryEntity = group.entities[0];

  // Check if any service name contains the base entity name (case-insensitive)
  const baseLower = group.base.toLowerCase();
  const hasRelatedServices = services.some(svc => {
    if (!svc || typeof svc !== 'string') {
      return false;
    }

    return svc.toLowerCase().includes(baseLower);
  });

  if (hasRelatedServices) {
    // CRUD pattern: entity with related services → all 5 operations
    const bindingRefs = [
      `moqui.${primaryEntity}.list`,
      `moqui.${primaryEntity}.get`,
      `moqui.${primaryEntity}.create`,
      `moqui.${primaryEntity}.update`,
      `moqui.${primaryEntity}.delete`
    ];

    const modelScope = generateEntityModelScope(primaryEntity, 'crud');
    const idempotencyKey = deriveIdempotencyKey(primaryEntity);

    return {
      pattern: 'crud',
      primaryResource: group.base,
      entities: [...group.entities],
      services: [],
      bindingRefs,
      modelScope,
      governance: {
        riskLevel: 'medium',
        approvalRequired: true,
        idempotencyRequired: true,
        idempotencyKey
      }
    };
  }

  // Query pattern: entity without related services → read-only (list + get)
  const bindingRefs = [
    `moqui.${primaryEntity}.list`,
    `moqui.${primaryEntity}.get`
  ];

  const modelScope = generateEntityModelScope(primaryEntity, 'query');

  return {
    pattern: 'query',
    primaryResource: group.base,
    entities: [...group.entities],
    services: [],
    bindingRefs,
    modelScope,
    governance: {
      riskLevel: 'low',
      approvalRequired: false,
      idempotencyRequired: false
    }
  };
}

/**
 * Match services against workflow pattern rules.
 * Services that don't directly map to entity CRUD operations are workflow candidates.
 * Groups related services into workflow patterns.
 *
 * @param {string[]} services - Service names
 * @param {string[]} entities - Entity names
 * @returns {PatternMatch[]}
 */
function matchWorkflowPatterns(services, entities) {
  if (!Array.isArray(services) || services.length === 0) {
    return [];
  }

  entities = Array.isArray(entities) ? entities : [];

  // Build a set of entity base names (lowercase) for matching
  const entityBaseNames = new Set();

  for (const entity of entities) {
    if (!entity || typeof entity !== 'string') {
      continue;
    }

    entityBaseNames.add(entity.toLowerCase());

    // Also add stripped base names (without Header/Item/Detail/Master suffixes)
    for (const suffixPair of HEADER_ITEM_SUFFIXES) {
      if (entity.endsWith(suffixPair.header)) {
        const base = entity.substring(0, entity.length - suffixPair.header.length);

        if (base) {
          entityBaseNames.add(base.toLowerCase());
        }
      }

      if (entity.endsWith(suffixPair.item)) {
        const base = entity.substring(0, entity.length - suffixPair.item.length);

        if (base) {
          entityBaseNames.add(base.toLowerCase());
        }
      }
    }
  }

  // Filter services that are NOT direct entity CRUD operations
  // A service is a CRUD operation if its name matches an entity base name
  const workflowServices = services.filter(svc => {
    if (!svc || typeof svc !== 'string') {
      return false;
    }

    const svcLower = svc.toLowerCase();

    // Check if the service name directly matches any entity base name
    for (const baseName of entityBaseNames) {
      if (svcLower === baseName || svcLower.includes(baseName)) {
        return false;
      }
    }

    return true;
  });

  if (workflowServices.length === 0) {
    return [];
  }

  // Find entities referenced by workflow services
  // (entities whose base name appears in any workflow service name)
  const referencedEntities = entities.filter(entity => {
    if (!entity || typeof entity !== 'string') {
      return false;
    }

    const entityLower = entity.toLowerCase();

    return workflowServices.some(svc => svc.toLowerCase().includes(entityLower));
  });

  // Generate binding refs for each workflow service
  const bindingRefs = workflowServices.map(svc => `moqui.service.${svc}.invoke`);

  // Generate model scope from referenced entities
  const read = [];
  const write = [];

  for (const entity of referencedEntities) {
    const idKey = deriveIdempotencyKey(entity);
    read.push(`moqui.${entity}.${idKey}`);
    read.push(`moqui.${entity}.statusId`);
    write.push(`moqui.${entity}.statusId`);
  }

  // Create a single workflow pattern match for all workflow services
  const primaryResource = workflowServices[0];

  return [{
    pattern: 'workflow',
    primaryResource,
    entities: referencedEntities.length > 0 ? [...referencedEntities] : [],
    services: [...workflowServices],
    bindingRefs,
    modelScope: { read, write },
    governance: {
      riskLevel: 'medium',
      approvalRequired: true,
      idempotencyRequired: true
    }
  }];
}

// ─── Resource Analysis (Orchestrator) ─────────────────────────

/**
 * Analyze discovered resources and identify business patterns.
 * Orchestrates pattern matching across all discovered resources,
 * applies optional --pattern filter, and handles the empty-match case.
 *
 * @param {DiscoveryPayload} discovery - Discovered resources { entities, services, screens }
 * @param {Object} options - { pattern?: string } — optional pattern filter ('crud' | 'query' | 'workflow')
 * @returns {PatternMatch[]}
 */
function analyzeResources(discovery, options = {}) {
  // Edge case: null/undefined/empty discovery
  if (!discovery) {
    return [];
  }

  const entities = Array.isArray(discovery.entities) ? discovery.entities : [];
  const services = Array.isArray(discovery.services) ? discovery.services : [];

  // If no entities and no services, nothing to analyze
  if (entities.length === 0 && services.length === 0) {
    return [];
  }

  const results = [];

  // Step 1: Group related entities
  const groups = groupRelatedEntities(entities);

  // Step 2: For each entity group, match against entity patterns (crud/query)
  for (const group of groups) {
    const match = matchEntityPattern(group, services);

    if (match) {
      results.push(match);
    }
  }

  // Step 3: Detect workflow patterns from services
  const workflowMatches = matchWorkflowPatterns(services, entities);

  for (const wm of workflowMatches) {
    results.push(wm);
  }

  // Step 4: Apply --pattern filter if provided
  if (options.pattern) {
    const filtered = results.filter(m => m.pattern === options.pattern);
    return filtered;
  }

  return results;
}

function buildBaseBindings(match) {
  const pattern = match.pattern;
  const bindings = [];

  if (pattern === 'crud' || pattern === 'query') {
    const primaryEntity = Array.isArray(match.entities) && match.entities.length > 0
      ? match.entities[0]
      : match.primaryResource;

    bindings.push({
      type: 'query',
      ref: `moqui.${primaryEntity}.list`,
      timeout_ms: 2000,
      retry: 0
    });
    bindings.push({
      type: 'query',
      ref: `moqui.${primaryEntity}.get`,
      timeout_ms: 2000,
      retry: 0
    });

    if (pattern === 'crud') {
      bindings.push({
        type: 'mutation',
        ref: `moqui.${primaryEntity}.create`,
        side_effect: true,
        timeout_ms: 3000,
        retry: 0
      });
      bindings.push({
        type: 'mutation',
        ref: `moqui.${primaryEntity}.update`,
        side_effect: true,
        timeout_ms: 3000,
        retry: 0
      });
      bindings.push({
        type: 'mutation',
        ref: `moqui.${primaryEntity}.delete`,
        side_effect: true,
        timeout_ms: 3000,
        retry: 0
      });
    }
  } else if (pattern === 'workflow') {
    const refs = Array.isArray(match.bindingRefs) ? match.bindingRefs : [];
    for (const ref of refs) {
      bindings.push({
        type: 'invoke',
        ref,
        timeout_ms: 3000,
        retry: 0
      });
    }
  }

  return bindings;
}

function deriveBindingIntent(binding, primaryResource) {
  const ref = String(binding.ref || '');

  if (ref.endsWith('.list')) {
    return `List ${primaryResource} records from Moqui`;
  }

  if (ref.endsWith('.get')) {
    return `Retrieve a single ${primaryResource} record`;
  }

  if (ref.endsWith('.create')) {
    return `Create a new ${primaryResource} record`;
  }

  if (ref.endsWith('.update')) {
    return `Update an existing ${primaryResource} record`;
  }

  if (ref.endsWith('.delete')) {
    return `Delete an existing ${primaryResource} record`;
  }

  if (ref.endsWith('.invoke')) {
    return `Invoke workflow service for ${primaryResource}`;
  }

  return `Execute ${ref}`;
}

function deriveBindingPreconditions(binding, previousRef) {
  const checks = ['Moqui adapter authentication is valid'];

  if (binding.type === 'query') {
    checks.push('Read scope permits this query');
  } else if (binding.type === 'mutation') {
    checks.push('Input payload validation passed');
  } else if (binding.type === 'invoke') {
    checks.push('Workflow input contract is satisfied');
  }

  if (previousRef) {
    checks.push(`Dependency ${previousRef} completed successfully`);
  }

  return checks;
}

function deriveBindingPostconditions(binding) {
  if (binding.type === 'query') {
    return ['Query result is available for downstream composition'];
  }

  if (binding.type === 'mutation') {
    return ['Mutation result is captured and write scope is consistent'];
  }

  if (binding.type === 'invoke') {
    return ['Workflow step output is captured for downstream execution'];
  }

  return ['Binding execution result is available'];
}

function addBindingSemantics(baseBindings, primaryResource) {
  const bindings = [];

  for (let i = 0; i < baseBindings.length; i++) {
    const base = baseBindings[i];
    const previous = i > 0 ? baseBindings[i - 1] : null;
    const binding = {
      ...base,
      intent: deriveBindingIntent(base, primaryResource),
      preconditions: deriveBindingPreconditions(base, previous ? previous.ref : null),
      postconditions: deriveBindingPostconditions(base)
    };

    if (previous && previous.ref) {
      binding.depends_on = previous.ref;
    }

    bindings.push(binding);
  }

  return bindings;
}

function buildDataLineage(bindings, pattern, primaryResource) {
  if (!Array.isArray(bindings) || bindings.length === 0) {
    return {
      sources: [],
      transforms: [],
      sinks: []
    };
  }

  const firstRef = bindings[0].ref;
  const lastRef = bindings[bindings.length - 1].ref;
  const sourceField = `${toKebabCase(primaryResource)}Id`;

  const transforms = [
    {
      operation: 'normalizeInput',
      description: `Normalize ${primaryResource} request payload for template execution`
    }
  ];

  if (pattern === 'workflow') {
    transforms.push({
      operation: 'orchestrateWorkflow',
      description: `Coordinate service chain for ${primaryResource}`
    });
  } else if (pattern === 'crud') {
    transforms.push({
      operation: 'applyMutationGuard',
      description: `Apply mutation and idempotency guard for ${primaryResource}`
    });
  } else {
    transforms.push({
      operation: 'projectQueryResult',
      description: `Project query result set for ${primaryResource}`
    });
  }

  return {
    sources: [
      {
        ref: firstRef,
        fields: [sourceField, 'statusId']
      }
    ],
    transforms,
    sinks: [
      {
        ref: lastRef,
        fields: [sourceField, 'statusId']
      }
    ]
  };
}

function buildEntityRefs(match, primaryResource) {
  const refs = Array.isArray(match.entities) && match.entities.length > 0
    ? match.entities.filter(Boolean)
    : [primaryResource];

  return refs.map((entity, index) => ({
    id: String(entity),
    type: index === 0 ? 'primary' : 'related'
  }));
}

function buildEntityRelations(entityRefs) {
  if (!Array.isArray(entityRefs) || entityRefs.length === 0) {
    return [];
  }

  const relations = [];
  const primaryId = entityRefs[0].id;

  for (let i = 1; i < entityRefs.length; i++) {
    relations.push({
      source: primaryId,
      target: entityRefs[i].id,
      type: 'composes'
    });
  }

  if (relations.length === 0) {
    relations.push({
      source: primaryId,
      target: 'metadata_view',
      type: 'produces'
    });
  }

  return relations;
}

function buildBusinessRules(pattern, bindings, primaryResource) {
  const firstRef = bindings[0] ? bindings[0].ref : null;
  const lastRef = bindings[bindings.length - 1] ? bindings[bindings.length - 1].ref : null;

  const rules = [
    {
      id: `rule.${toKebabCase(primaryResource)}.binding-order`,
      description: `Bindings for ${primaryResource} must execute in declared dependency order`,
      bind_to: firstRef,
      status: 'enforced'
    }
  ];

  if (pattern === 'query') {
    rules.push({
      id: `rule.${toKebabCase(primaryResource)}.read-only`,
      description: `${primaryResource} query template must remain side-effect free`,
      bind_to: lastRef,
      status: 'active'
    });
  } else {
    rules.push({
      id: `rule.${toKebabCase(primaryResource)}.approval-or-idempotency`,
      description: `${primaryResource} template must enforce approval or idempotency guard`,
      bind_to: lastRef,
      status: 'active'
    });
  }

  return rules;
}

function buildDecisionLogic(pattern, bindings, primaryResource) {
  const lastRef = bindings[bindings.length - 1] ? bindings[bindings.length - 1].ref : null;
  const riskDecision = pattern === 'query'
    ? 'Use low-risk dry-run defaults for query execution'
    : 'Use guarded execution with approval and retry policies';

  return [
    {
      id: `decision.${toKebabCase(primaryResource)}.risk-strategy`,
      description: riskDecision,
      bind_to: lastRef,
      status: 'resolved',
      automated: true
    },
    {
      id: `decision.${toKebabCase(primaryResource)}.retry-strategy`,
      description: 'Apply timeout/retry profile derived from template contract',
      bind_to: lastRef,
      status: 'resolved',
      automated: true
    }
  ];
}

function buildAgentHints(pattern, primaryResource, bindings) {
  const complexity = pattern === 'query' ? 'low' : 'medium';
  const baseDuration = pattern === 'query' ? 1800 : 3000;
  const permissions = pattern === 'query'
    ? ['moqui.read']
    : ['moqui.read', 'moqui.write'];

  return {
    summary: `${pattern.toUpperCase()} template extracted for ${primaryResource} with Moqui-aware ontology`,
    complexity,
    estimated_duration_ms: baseDuration + (bindings.length * 150),
    required_permissions: permissions,
    suggested_sequence: bindings.map((binding) => binding.ref),
    rollback_strategy: pattern === 'query'
      ? 'Re-run query with previous filters'
      : 'Reconcile idempotency key and rollback to pre-mutation snapshot'
  };
}

// ─── Scene Manifest Generation ────────────────────────────────────

/**
 * Generate a scene manifest object for a pattern match.
 * Produces a manifest with correct apiVersion, kind, bindings, model_scope,
 * and governance_contract based on the pattern type.
 *
 * Pattern rules for bindings:
 * - "crud": 5 bindings (list, get = query; create, update, delete = mutation with side_effect)
 * - "query": 2 bindings (list, get = query)
 * - "workflow": service invoke bindings (type: 'invoke', ref from bindingRefs)
 *
 * Governance rules:
 * - "query": risk_level "low", approval.required false, no idempotency
 * - "crud"/"workflow": risk_level "medium", approval.required true, idempotency.required true
 *
 * @param {PatternMatch} match - Matched pattern
 * @returns {Object|null} Scene manifest object, or null for invalid input
 */
function generateSceneManifest(match) {
  if (!match || !match.pattern || !match.primaryResource) {
    return null;
  }

  const pattern = match.pattern;
  const primaryResource = match.primaryResource;
  const packageName = derivePackageName(match);
  const gov = match.governance || {};

  const baseBindings = buildBaseBindings(match);
  const bindings = addBindingSemantics(baseBindings, primaryResource);

  // Build model_scope from match
  const modelScope = match.modelScope || { read: [], write: [] };

  // Build governance_contract based on pattern type
  const riskLevel = gov.riskLevel || (pattern === 'query' ? 'low' : 'medium');
  const approvalRequired = gov.approvalRequired !== undefined
    ? gov.approvalRequired
    : (pattern !== 'query');
  const idempotencyRequired = gov.idempotencyRequired !== undefined
    ? gov.idempotencyRequired
    : (pattern !== 'query');
  const idempotencyKey = gov.idempotencyKey || deriveIdempotencyKey(
    Array.isArray(match.entities) && match.entities.length > 0
      ? match.entities[0]
      : primaryResource
  );

  const governanceContract = {
    risk_level: riskLevel,
    approval: {
      required: approvalRequired
    },
    data_lineage: buildDataLineage(bindings, pattern, primaryResource)
  };

  if (idempotencyRequired) {
    governanceContract.idempotency = {
      required: true,
      key: idempotencyKey
    };
  }

  // Build intent goal based on pattern type
  let goal;

  if (pattern === 'crud') {
    goal = `Full CRUD operations for ${primaryResource} entity`;
  } else if (pattern === 'query') {
    goal = `Read-only access to ${primaryResource} entity`;
  } else if (pattern === 'workflow') {
    goal = `Workflow orchestration for ${primaryResource} service`;
  } else {
    goal = `Operations for ${primaryResource}`;
  }

  return {
    apiVersion: SCENE_API_VERSION,
    kind: 'scene',
    metadata: {
      obj_id: `scene.extracted.${packageName}`,
      obj_version: '0.1.0',
      title: `${pattern.charAt(0).toUpperCase() + pattern.slice(1)} ${primaryResource} Template`
    },
    spec: {
      domain: 'erp',
      intent: {
        goal
      },
      model_scope: {
        read: Array.isArray(modelScope.read) ? [...modelScope.read] : [],
        write: Array.isArray(modelScope.write) ? [...modelScope.write] : []
      },
      capability_contract: {
        bindings
      },
      governance_contract: governanceContract
    }
  };
}

// ─── Package Contract Generation ──────────────────────────────────

/**
 * Generate a package contract object for a pattern match.
 * Produces a contract with correct apiVersion, kind, metadata, parameters,
 * artifacts, and governance fields.
 *
 * @param {PatternMatch} match - Matched pattern
 * @returns {Object|null} Package contract object, or null for invalid input
 */
function generatePackageContract(match) {
  if (!match || !match.pattern || !match.primaryResource) {
    return null;
  }

  const pattern = match.pattern;
  const primaryResource = match.primaryResource;
  const packageName = derivePackageName(match);
  const gov = match.governance || {};
  const baseBindings = buildBaseBindings(match);
  const bindings = addBindingSemantics(baseBindings, primaryResource);
  const riskLevel = gov.riskLevel || (pattern === 'query' ? 'low' : 'medium');
  const approvalRequired = gov.approvalRequired !== undefined
    ? gov.approvalRequired
    : (pattern !== 'query');
  const idempotencyRequired = gov.idempotencyRequired !== undefined
    ? gov.idempotencyRequired
    : (pattern !== 'query');
  const idempotencyKey = gov.idempotencyKey || deriveIdempotencyKey(
    Array.isArray(match.entities) && match.entities.length > 0
      ? match.entities[0]
      : primaryResource
  );
  const entityRefs = buildEntityRefs(match, primaryResource);
  const relations = buildEntityRelations(entityRefs);
  const hasMetadataView = entityRefs.some((entity) => entity.id === 'metadata_view');

  if (!hasMetadataView) {
    entityRefs.push({ id: 'metadata_view', type: 'projection' });
  }

  const hasMetadataRelation = relations.some((relation) => (
    relation.source === entityRefs[0].id
    && relation.target === 'metadata_view'
    && relation.type === 'produces'
  ));

  if (!hasMetadataRelation) {
    relations.push({
      source: entityRefs[0].id,
      target: 'metadata_view',
      type: 'produces'
    });
  }

  // Derive summary based on pattern type
  let summary;

  if (pattern === 'crud') {
    summary = `CRUD template for ${primaryResource} entity extracted from Moqui ERP`;
  } else if (pattern === 'query') {
    summary = `Query template for ${primaryResource} entity extracted from Moqui ERP`;
  } else if (pattern === 'workflow') {
    summary = `Workflow template for ${primaryResource} service extracted from Moqui ERP`;
  } else {
    summary = `Template for ${primaryResource} extracted from Moqui ERP`;
  }

  const governanceContract = {
    risk_level: riskLevel,
    approval: {
      required: approvalRequired
    },
    data_lineage: buildDataLineage(bindings, pattern, primaryResource),
    business_rules: buildBusinessRules(pattern, bindings, primaryResource),
    decision_logic: buildDecisionLogic(pattern, bindings, primaryResource)
  };

  if (idempotencyRequired) {
    governanceContract.idempotency = {
      required: true,
      key: idempotencyKey
    };
  }

  return {
    apiVersion: PACKAGE_API_VERSION,
    kind: 'scene-template',
    metadata: {
      group: 'kse.scene',
      name: packageName,
      version: '0.1.0',
      summary,
      description: `${summary}. Includes ontology graph hints, lineage tracing, and AI execution metadata.`
    },
    compatibility: {
      kse_version: '>=1.39.0',
      scene_api_version: SCENE_API_VERSION
    },
    parameters: [
      {
        id: 'timeout_ms',
        type: 'number',
        required: false,
        default: 2000,
        description: 'Request timeout in milliseconds'
      },
      {
        id: 'retry_count',
        type: 'number',
        required: false,
        default: 0,
        description: 'Number of retry attempts'
      }
    ],
    artifacts: {
      entry_scene: 'scene.yaml',
      generates: ['scene.yaml', 'scene-package.json']
    },
    governance: {
      risk_level: riskLevel,
      approval_required: approvalRequired,
      approval: {
        required: approvalRequired
      },
      idempotency: {
        required: idempotencyRequired,
        key: idempotencyKey
      },
      rollback_supported: true
    },
    capability_contract: {
      bindings
    },
    governance_contract: governanceContract,
    ontology_model: {
      entities: entityRefs,
      relations
    },
    agent_hints: buildAgentHints(pattern, primaryResource, bindings)
  };
}

// ─── File Writing ─────────────────────────────────────────────────

/**
 * Write template bundles to the output directory.
 * Creates one subdirectory per bundle containing scene.yaml and scene-package.json.
 * Partial failure resilient: if one bundle fails, continues with remaining bundles.
 *
 * @param {TemplateBundleOutput[]} bundles - Generated bundles
 * @param {string} outDir - Output directory path
 * @param {Object} [fileSystem] - fs-extra compatible file system (for DI/testing)
 * @returns {Promise<WriteResult[]>}
 */
async function writeTemplateBundles(bundles, outDir, fileSystem) {
  // Handle null/empty bundles gracefully
  if (!bundles || !Array.isArray(bundles) || bundles.length === 0) {
    return [];
  }

  const fs = fileSystem || require('fs-extra');
  const results = [];

  // Ensure outDir exists (create recursively if needed)
  try {
    fs.ensureDirSync(outDir);
  } catch (err) {
    // If we can't create the output directory, all bundles fail
    for (const bundle of bundles) {
      results.push({
        bundleDir: bundle.bundleDir || '',
        success: false,
        error: `Failed to create output directory: ${err.message}`
      });
    }
    return results;
  }

  // Write each bundle with partial failure resilience
  for (const bundle of bundles) {
    const bundleDir = bundle.bundleDir || '';
    const bundlePath = path.join(outDir, bundleDir);

    try {
      // Create subdirectory for this bundle
      fs.ensureDirSync(bundlePath);

      // Write scene.yaml
      const sceneYamlPath = path.join(bundlePath, 'scene.yaml');
      fs.writeFileSync(sceneYamlPath, bundle.manifestYaml || '');

      // Write scene-package.json
      const packageJsonPath = path.join(bundlePath, 'scene-package.json');
      fs.writeFileSync(packageJsonPath, bundle.contractJson || '');

      results.push({ bundleDir, success: true });
    } catch (err) {
      // Catch error, add to results, continue with remaining bundles
      results.push({
        bundleDir,
        success: false,
        error: err.message
      });
    }
  }

  return results;
}

// ─── Discovery ────────────────────────────────────────────────────

/**
 * Catalog endpoint definitions for Moqui resource discovery.
 * Each entry maps a resource type to its API endpoint and response key.
 */
const CATALOG_ENDPOINTS = {
  entities: { path: '/api/v1/entities', key: 'entities' },
  services: { path: '/api/v1/services', key: 'services' },
  screens:  { path: '/api/v1/screens',  key: 'screens' }
};

/**
 * Discover resources from a Moqui instance.
 * Queries catalog endpoints with optional type filtering and partial failure handling.
 *
 * @param {MoquiClient} client - Authenticated MoquiClient instance
 * @param {Object} [options] - Discovery options
 * @param {string} [options.type] - Filter: 'entities' | 'services' | 'screens'
 * @returns {Promise<{ entities: string[], services: string[], screens: string[], warnings: string[] }>}
 */
async function discoverResources(client, options = {}) {
  const result = {
    entities: [],
    services: [],
    screens: [],
    warnings: []
  };

  // Determine which types to query
  const typesToQuery = options.type
    ? [options.type]
    : ['entities', 'services', 'screens'];

  for (const typeName of typesToQuery) {
    const endpoint = CATALOG_ENDPOINTS[typeName];
    if (!endpoint) {
      result.warnings.push(`Unknown resource type: ${typeName}`);
      continue;
    }

    try {
      const response = await client.request('GET', endpoint.path);

      if (!response || !response.success) {
        const errMsg = (response && response.error && response.error.message)
          || `Failed to query ${typeName}`;
        result.warnings.push(`${typeName}: ${errMsg}`);
        continue;
      }

      // Extract data from response
      const rawData = response.data;
      let items;

      if (Array.isArray(rawData)) {
        items = rawData;
      } else if (rawData && typeof rawData === 'object') {
        items = rawData[endpoint.key] || rawData.items || [];
      } else {
        items = [];
      }

      // Ensure items is an array of strings
      result[typeName] = Array.isArray(items)
        ? items.map(item => (typeof item === 'string' ? item : String(item)))
        : [];
    } catch (err) {
      // Partial failure: continue with other endpoints
      result.warnings.push(`${typeName}: ${err.message}`);
    }
  }

  return result;
}

// ─── Extraction Pipeline ──────────────────────────────────────────

/**
 * Default output directory for extracted templates.
 */
const DEFAULT_OUT_DIR = '.kiro/templates/extracted';

/**
 * Run the full extraction pipeline.
 * Orchestrates: config loading → client creation → login → discover → analyze → generate → write (or dry-run) → dispose.
 *
 * @param {Object} [options] - Extraction options
 * @param {string} [options.config] - Path to moqui-adapter.json
 * @param {string} [options.type] - Filter: 'entities' | 'services' | 'screens'
 * @param {string} [options.pattern] - Filter: 'crud' | 'query' | 'workflow'
 * @param {string} [options.out] - Output directory path
 * @param {boolean} [options.dryRun] - Preview without writing files
 * @param {boolean} [options.json] - Output as JSON
 * @param {Object} [dependencies] - Dependency injection for testing
 * @param {string} [dependencies.projectRoot] - Project root directory
 * @param {Object} [dependencies.fileSystem] - fs-extra compatible file system
 * @param {MoquiClient} [dependencies.client] - Pre-configured MoquiClient (skips config/login)
 * @returns {Promise<ExtractionResult>}
 */
async function runExtraction(options = {}, dependencies = {}) {
  const outDir = options.out || DEFAULT_OUT_DIR;
  let client = dependencies.client || null;
  let clientOwned = false; // Track if we created the client (and thus must dispose it)

  /**
   * Build an error ExtractionResult.
   */
  function makeErrorResult(code, message, warnings = []) {
    return {
      success: false,
      templates: [],
      summary: {
        totalTemplates: 0,
        patterns: { crud: 0, query: 0, workflow: 0 },
        outputDir: outDir
      },
      warnings,
      error: { code, message }
    };
  }

  try {
    // ── Step 1: Load and validate config (skip if client injected) ──
    if (!client) {
      const projectRoot = dependencies.projectRoot || process.cwd();
      const configResult = loadAdapterConfig(options.config, projectRoot);

      if (configResult.error) {
        const code = configResult.error.startsWith('CONFIG_NOT_FOUND')
          ? 'CONFIG_NOT_FOUND'
          : 'CONFIG_INVALID';
        return makeErrorResult(code, configResult.error);
      }

      const validation = validateAdapterConfig(configResult.config);
      if (!validation.valid) {
        return makeErrorResult(
          'CONFIG_INVALID',
          `Invalid adapter config: ${validation.errors.join('; ')}`
        );
      }

      // ── Step 2: Create MoquiClient ──
      client = new MoquiClient(configResult.config);
      clientOwned = true;

      // ── Step 3: Login ──
      const loginResult = await client.login();
      if (!loginResult.success) {
        return makeErrorResult(
          'AUTH_FAILED',
          loginResult.error || 'Authentication failed'
        );
      }
    }

    // ── Step 4: Discover resources ──
    const discovery = await discoverResources(client, { type: options.type });
    const warnings = [...discovery.warnings];

    // ── Step 5: Analyze resources ──
    const matches = analyzeResources(discovery, { pattern: options.pattern });

    // ── Step 6: Generate manifests and contracts ──
    const templates = [];
    const patternCounts = { crud: 0, query: 0, workflow: 0 };

    for (const match of matches) {
      const manifest = generateSceneManifest(match);
      const contract = generatePackageContract(match);
      const manifestYaml = serializeManifestToYaml(manifest);
      const contractJson = JSON.stringify(contract, null, 2);
      const bundleDir = deriveBundleDirName(match);

      templates.push({
        bundleDir,
        manifest,
        contract,
        manifestYaml,
        contractJson
      });

      if (patternCounts[match.pattern] !== undefined) {
        patternCounts[match.pattern]++;
      }
    }

    // ── Step 7: Write bundles (unless dry-run) ──
    if (!options.dryRun && templates.length > 0) {
      const fs = dependencies.fileSystem || undefined;
      const writeResults = await writeTemplateBundles(templates, outDir, fs);

      // Collect write warnings
      for (const wr of writeResults) {
        if (!wr.success) {
          warnings.push(`Write failed for ${wr.bundleDir}: ${wr.error}`);
        }
      }
    }

    // ── Step 8: Build and return ExtractionResult ──
    return {
      success: true,
      templates,
      summary: {
        totalTemplates: templates.length,
        patterns: patternCounts,
        outputDir: outDir
      },
      warnings,
      error: null
    };
  } catch (err) {
    // Wrap unexpected errors
    const code = (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.code === 'ETIMEDOUT')
      ? 'NETWORK_ERROR'
      : 'EXTRACT_FAILED';
    return makeErrorResult(code, err.message);
  } finally {
    // ── Always dispose client if we own it ──
    if (client && clientOwned) {
      try {
        await client.dispose();
      } catch (_) {
        // Ignore dispose errors
      }
    }
  }
}

// ─── Module Exports ───────────────────────────────────────────────

module.exports = {
  // Constants
  SUPPORTED_PATTERNS,
  HEADER_ITEM_SUFFIXES,
  SCENE_API_VERSION,
  PACKAGE_API_VERSION,
  CATALOG_ENDPOINTS,
  DEFAULT_OUT_DIR,
  // YAML functions
  serializeManifestToYaml,
  parseYaml,
  // Entity grouping
  groupRelatedEntities,
  // Pattern matching
  matchEntityPattern,
  matchWorkflowPatterns,
  // Resource analysis
  analyzeResources,
  // Generation
  generateSceneManifest,
  generatePackageContract,
  // Name derivation
  deriveBundleDirName,
  derivePackageName,
  // File writing
  writeTemplateBundles,
  // Discovery & extraction pipeline
  discoverResources,
  runExtraction,
  // Internal helpers (exported for testing)
  needsYamlQuoting,
  formatYamlValue,
  parseScalarValue,
  toKebabCase,
  deriveIdempotencyKey,
  generateEntityModelScope
};

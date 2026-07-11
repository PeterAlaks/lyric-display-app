import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  ACTION_LOG_MAX_ENTRIES,
  AUDITED_REALTIME_CONTRACTS,
  AUDITED_REST_CONTRACTS,
} from '../shared/apiContractRegistry.js';
import { MAX_SETLIST_ITEMS } from '../shared/setlistLimits.js';

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function getMessageBlock(document, name) {
  const pattern = new RegExp(`^    ${escapeRegExp(name)}:\\r?\\n([\\s\\S]*?)(?=^    [A-Za-z][A-Za-z0-9_]*:|(?![\\s\\S]))`, 'm');
  return document.match(pattern)?.[0] || '';
}

function getOperationBlock(document, operationName) {
  const pattern = new RegExp(`^  ${escapeRegExp(operationName)}:\\r?\\n([\\s\\S]*?)(?=^  [A-Za-z][A-Za-z0-9_]*:|^components:|(?![\\s\\S]))`, 'm');
  return document.match(pattern)?.[0] || '';
}

export function validateApiContracts(rootDir = process.cwd()) {
  const asyncApiPath = path.join(rootDir, 'docs', 'asyncapi.yaml');
  const openApiPath = path.join(rootDir, 'docs', 'openapi.yaml');
  const asyncApi = fs.readFileSync(asyncApiPath, 'utf8');
  const openApi = fs.readFileSync(openApiPath, 'utf8');
  const errors = [];
  const clientOperation = getOperationBlock(asyncApi, 'clientEvents');
  const serverOperation = getOperationBlock(asyncApi, 'serverEvents');

  for (const contract of AUDITED_REALTIME_CONTRACTS) {
    const block = getMessageBlock(asyncApi, contract.name);
    if (!block) {
      errors.push(`AsyncAPI is missing components.messages.${contract.name}`);
      continue;
    }
    if (!new RegExp(`^      name: ${escapeRegExp(contract.name)}$`, 'm').test(block)) {
      errors.push(`AsyncAPI message ${contract.name} has a mismatched runtime name`);
    }
    const channelReference = `#/channels/socketChannel/messages/${contract.name}`;
    if (!asyncApi.includes(channelReference)) {
      errors.push(`AsyncAPI channel is missing ${contract.name}`);
    }
    const operation = contract.direction === 'client' ? clientOperation : serverOperation;
    if (!operation.includes(channelReference)) {
      errors.push(`AsyncAPI ${contract.direction} operation is missing ${contract.name}`);
    }
    if (contract.permissions) {
      const expected = `x-permissions: [${contract.permissions.map((item) => `'${item}'`).join(', ')}]`;
      if (!block.includes(expected)) {
        errors.push(`AsyncAPI message ${contract.name} permissions drifted; expected ${expected}`);
      }
    }
  }

  for (const messageName of ['setlistAdd', 'setlistReplace']) {
    const block = getMessageBlock(asyncApi, messageName);
    if (!block.includes(`maxItems: ${MAX_SETLIST_ITEMS}`)) {
      errors.push(`AsyncAPI ${messageName} maximum must use the shared limit ${MAX_SETLIST_ITEMS}`);
    }
  }

  for (const [messageName, keyword] of [['requestActionLog', 'maximum'], ['actionLogSnapshot', 'maxItems']]) {
    const block = getMessageBlock(asyncApi, messageName);
    if (!block.includes(`${keyword}: ${ACTION_LOG_MAX_ENTRIES}`)) {
      errors.push(`AsyncAPI ${messageName} must use the shared action-log limit ${ACTION_LOG_MAX_ENTRIES}`);
    }
  }

  for (const contract of AUDITED_REST_CONTRACTS) {
    const pathHeader = `  ${contract.path}:`;
    const start = openApi.indexOf(pathHeader);
    if (start < 0) {
      errors.push(`OpenAPI is missing ${contract.method.toUpperCase()} ${contract.path}`);
      continue;
    }
    const nextPath = openApi.indexOf('\n  /api/', start + pathHeader.length);
    const block = openApi.slice(start, nextPath < 0 ? undefined : nextPath);
    if (!new RegExp(`^    ${contract.method}:$`, 'm').test(block)) {
      errors.push(`OpenAPI is missing ${contract.method.toUpperCase()} ${contract.path}`);
    }
  }

  return errors;
}

function runCli() {
  const errors = validateApiContracts();
  if (errors.length > 0) {
    errors.forEach((error) => console.error(`[contracts] ${error}`));
    process.exitCode = 1;
    return;
  }
  console.log(`API contract validation passed (${AUDITED_REALTIME_CONTRACTS.length} realtime events, ${AUDITED_REST_CONTRACTS.length} REST operations).`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  runCli();
}

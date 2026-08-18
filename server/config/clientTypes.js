import { isRoutableOutputId } from '../../shared/outputRegistry.js';

export const VALID_CLIENT_TYPES = ['desktop', 'web', 'obsDock', 'output1', 'output2', 'stage', 'mobile'];
export const CONTROLLER_CLIENT_TYPES = ['web', 'mobile', 'obsDock'];
export const OUTPUT_DISCOVERY_CLIENT_TYPE = 'output-discovery';

export const isOutputClientType = (type) => typeof type === 'string' && type.startsWith('output');
export const isOutputDisplayClientType = (type) => isRoutableOutputId(type);
export const isControllerClient = (clientType) => CONTROLLER_CLIENT_TYPES.includes(clientType);

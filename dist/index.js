import { ThermostatPlatform } from './platform.js';
import { PLATFORM_NAME } from './settings.js';
export default (api) => {
    api.registerPlatform(PLATFORM_NAME, ThermostatPlatform);
};
//# sourceMappingURL=index.js.map
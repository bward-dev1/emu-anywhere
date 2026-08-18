import { useCallback, useEffect, useState } from 'preact/hooks';
import { System } from '../cores/types';
import {
  InputConfig,
  SystemBindings,
  defaultsFor,
  loadConfig,
  saveConfig
} from './bindings';

/**
 * One live copy of the input config, shared by the settings UI and the running
 * emulator.
 *
 * These two are mounted in different subtrees (SettingsModal is a sibling of
 * Emulator, not a child), so component state cannot carry the config between
 * them. Without a shared store, rebinding a key would update the menu and the
 * game would keep using the old map until a reload -- which is most of what
 * "the settings don't reach the core" meant in the first place.
 */

let current: InputConfig | null = null;
const listeners = new Set<(config: InputConfig) => void>();

export const getInputConfig = (): InputConfig => {
  if (!current) current = loadConfig();
  return current;
};

export const setInputConfig = (next: InputConfig): void => {
  current = next;
  saveConfig(next);
  for (const listener of listeners) listener(next);
};

export const updateSystemBindings = (system: System, bindings: SystemBindings): void => {
  const config = getInputConfig();
  setInputConfig({ ...config, [system]: bindings });
};

export const resetSystemBindings = (system: System): void => {
  updateSystemBindings(system, defaultsFor(system));
};

export const subscribeInputConfig = (listener: (config: InputConfig) => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Read the config and re-render whenever anything changes it. */
export const useInputConfig = (): InputConfig => {
  const [config, setConfig] = useState<InputConfig>(getInputConfig);
  useEffect(() => subscribeInputConfig(setConfig), []);
  return config;
};

/** The bindings for one system, plus the writers the settings UI needs. */
export const useSystemBindings = (system: System) => {
  const config = useInputConfig();

  const write = useCallback(
    (bindings: SystemBindings) => updateSystemBindings(system, bindings),
    [system]
  );

  const reset = useCallback(() => resetSystemBindings(system), [system]);

  return { config, bindings: config[system], write, reset };
};

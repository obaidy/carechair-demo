import * as SecureStore from 'expo-secure-store';

export async function secureGet(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

export async function secureSet(key: string, value: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(key, value);
  } catch {
    // Best effort.
  }
}

export async function secureRemove(key: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    // Best effort.
  }
}

export function createSecureStorageAdapter(prefix: string) {
  return {
    getItem: async (key: string) => secureGet(`${prefix}:${key}`),
    setItem: async (key: string, value: string) => {
      await secureSet(`${prefix}:${key}`, value);
    },
    removeItem: async (key: string) => {
      await secureRemove(`${prefix}:${key}`);
    }
  };
}

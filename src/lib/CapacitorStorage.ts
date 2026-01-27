import { Preferences } from '@capacitor/preferences'

/**
 * Custom storage adapter for Supabase to use Capacitor Preferences.
 * This ensures auth tokens are persisted reliably on Android/iOS.
 */
export const CapacitorStorage = {
    getItem: async (key: string): Promise<string | null> => {
        const { value } = await Preferences.get({ key })
        return value
    },
    setItem: async (key: string, value: string): Promise<void> => {
        await Preferences.set({ key, value })
    },
    removeItem: async (key: string): Promise<void> => {
        await Preferences.remove({ key })
    }
}

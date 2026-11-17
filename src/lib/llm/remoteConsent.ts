import { Alert } from 'react-native';

import { useSettingsStore } from '@/stores/settingsStore';

/**
 * Explicit permission before a photo is sent to a remote AI endpoint (OpenAI, Gemini,
 * OpenRouter, or a self-hosted server). App Store guideline 5.1.2(i) requires apps to disclose
 * when personal data is shared with a third-party AI and get the user's permission first. The
 * answer is remembered on the profile (`aiRemoteConsent`); "Not now" is asked again next time.
 *
 * Called when the user picks "API / cloud" in Settings, and again as a gate right before any
 * remote request (covers users who switched to remote before this prompt existed).
 */
export function ensureRemoteAiConsent(endpointName?: string): Promise<boolean> {
  if (useSettingsStore.getState().profile.aiRemoteConsent) return Promise.resolve(true);
  const target = endpointName ? `“${endpointName}”` : 'the AI endpoint you set up';
  return new Promise((resolve) => {
    Alert.alert(
      'Send photos to your AI endpoint?',
      `With API / cloud AI, the food or label photo you scan is sent to ${target} to be read. ` +
        'If that’s a cloud service (like OpenAI or Google Gemini), it’s handled under that provider’s ' +
        'privacy terms. Hale itself never receives your photos.\n\nOn-device AI keeps photos on your phone.',
      [
        { text: 'Not now', style: 'cancel', onPress: () => resolve(false) },
        {
          text: 'Allow',
          onPress: () => {
            useSettingsStore.getState().setProfile({ aiRemoteConsent: true });
            resolve(true);
          },
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });
}

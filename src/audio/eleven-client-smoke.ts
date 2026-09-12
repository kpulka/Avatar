import { Conversation } from '@elevenlabs/client';
import { getActiveAgentId } from './agent-config';

/**
 * Test dymny weryfikujący połączenie z agentem przy użyciu oficjalnego SDK @elevenlabs/client.
 * Służy do potwierdzenia poprawności agent_id i uprawnień przed uruchomieniem surowego WSS (docs/2, docs/6).
 */
export async function runSdkSmokeTest(customAgentId?: string): Promise<{
  success: boolean;
  status: string;
  conversation?: Conversation;
  error?: string;
}> {
  const agentId = customAgentId || getActiveAgentId();

  if (!agentId || agentId === 'demo-avatar-agent') {
    return {
      success: false,
      status: 'skipped',
      error: 'Brak aktywnego ElevenLabs agent_id (skonfiguruj parametr ?agent_id=... w URL)',
    };
  }

  try {
    console.log(`[SDK Smoke] Rozpoczynanie testu dymnego dla agenta: ${agentId}`);

    const conversation = await Conversation.startSession({
      agentId,
      onConnect: () => console.log('[SDK Smoke] Połączono z agentem ElevenLabs'),
      onDisconnect: () => console.log('[SDK Smoke] Rozłączono z agentem ElevenLabs'),
      onError: (err) => console.error('[SDK Smoke] Błąd sesji:', err),
      onModeChange: (mode) => console.log('[SDK Smoke] Zmiana trybu:', mode),
    });

    console.log('[SDK Smoke] Sesja zainicjalizowana pomyślnie.');

    return {
      success: true,
      status: 'connected',
      conversation,
    };
  } catch (err) {
    const errorMsg = (err as Error).message || String(err);
    console.warn(`[SDK Smoke] Test dymny zakończony błędem: ${errorMsg}`);
    return {
      success: false,
      status: 'error',
      error: errorMsg,
    };
  }
}

import { useState } from 'react';
import {
  useLlmProvidersWithRegistrations,
  useRegisterProvider,
  useRefreshModels,
  useDeleteProvider,
  useToggleProvider,
} from '@/presentation/hooks/providers/useProviders';
import { serializeCredentials } from '@/constants/providers';
import { ERRORS } from '@/constants/errors';
import { ProviderTile } from './ProviderTile';
import { ProviderModal } from './ProviderModal';

/**
 * Providers settings page.
 *
 * Stores only `selectedId` — the selected provider is derived from the live
 * `providers` query result on every render. This ensures the modal always
 * reflects fresh data after any mutation (toggle, refresh, connect, disconnect).
 */
export default function ProvidersView() {
  const { data: providers = [], isLoading, isError } = useLlmProvidersWithRegistrations();

  const registerProvider = useRegisterProvider();
  const refreshModels    = useRefreshModels();
  const deleteProvider   = useDeleteProvider();
  const toggleProvider   = useToggleProvider();

  const [selectedId, setSelectedId]             = useState<string | null>(null);
  const [credentialValues, setCredentialValues] = useState<Record<string, string>>({});
  const [connectError, setConnectError]         = useState('');
  const [connecting, setConnecting]             = useState(false);
  const [disconnectError, setDisconnectError]   = useState('');
  const [disconnecting, setDisconnecting]       = useState(false);
  const [refreshing, setRefreshing]             = useState(false);

  // Always derived from live query — never stale after mutations
  const selected = selectedId ? (providers.find((p) => p.id === selectedId) ?? null) : null;

  function openModal(id: string) {
    setSelectedId(id);
    setCredentialValues({});
    setConnectError('');
    setDisconnectError('');
  }

  function closeModal() {
    setSelectedId(null);
    setCredentialValues({});
    setConnectError('');
    setDisconnectError('');
  }

  async function handleConnect() {
    if (!selected) return;
    setConnectError('');
    setConnecting(true);
    try {
      const apiKey = serializeCredentials(selected.credentialKind, credentialValues);
      await registerProvider.mutateAsync({ llmProviderId: selected.id, apiKey });
      setCredentialValues({});
    } catch {
      setConnectError(ERRORS.PRV_003.message);
    } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    const userProvider = selected?.userProviders[0];
    if (!userProvider) return;
    setDisconnectError('');
    setDisconnecting(true);
    try {
      await deleteProvider.mutateAsync(userProvider.id);
      closeModal();
    } catch {
      setDisconnectError(ERRORS.PRV_004.message);
    } finally {
      setDisconnecting(false);
    }
  }

  async function handleRefresh() {
    const userProvider = selected?.userProviders[0];
    if (!userProvider) return;
    setRefreshing(true);
    try {
      await refreshModels.mutateAsync(userProvider.id);
    } finally {
      setRefreshing(false);
    }
  }

  const activeUserProvider = selected?.userProviders[0] ?? null;
  const modalModels        = activeUserProvider?.models ?? [];

  return (
    <div className="flex flex-col gap-7">
      <div>
        <h2 className="text-xl font-bold text-[#ececea]">Providers</h2>
        <p className="mt-1.5 text-[13px] text-[#737373]">
          Connect your LLM providers. Click a tile to manage credentials and models.
        </p>
      </div>

      {isLoading && (
        <p className="text-[13px] text-[#737373]" aria-live="polite">Loading providers…</p>
      )}
      {isError && (
        <p role="alert" className="text-[13px] text-[#ef4444]">{ERRORS.PRV_005.message}</p>
      )}

      {!isLoading && !isError && providers.length > 0 && (
        <div className="flex flex-wrap gap-3.5">
          {providers.map((item) => {
            const up = item.userProviders[0];
            return (
              <ProviderTile
                key={item.id}
                llmProvider={item}
                connected={!!up}
                providerEnabled={up?.enabled}
                onToggleEnabled={up ? () => toggleProvider.mutate({ id: up.id, enabled: !up.enabled }) : undefined}
                onClick={() => openModal(item.id)}
              />
            );
          })}
        </div>
      )}

      {!isLoading && !isError && providers.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <p className="text-base font-semibold text-[#ececea]">No providers available</p>
          <p className="text-[13px] text-[#737373]">Contact your administrator to enable providers.</p>
        </div>
      )}

      <ProviderModal
        llmProvider={selected}
        userProvider={activeUserProvider}
        models={modalModels}
        open={selectedId !== null}
        onClose={closeModal}
        connecting={connecting}
        connectError={connectError}
        credentialValues={credentialValues}
        onCredentialChange={(key, val) => setCredentialValues((prev) => ({ ...prev, [key]: val }))}
        onConnect={handleConnect}
        disconnecting={disconnecting}
        disconnectError={disconnectError}
        onDisconnect={handleDisconnect}
        refreshing={refreshing}
        onRefresh={handleRefresh}
      />
    </div>
  );
}

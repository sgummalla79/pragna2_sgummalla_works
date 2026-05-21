import * as Dialog from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils';
import { providerColor, providerInitial } from '@/constants/providers';
import { PROVIDER_LOGO_URLS, MONO_BLACK_PROVIDERS } from '@/assets/providerLogos';
import { ProviderConnectForm } from './ProviderConnectForm';
import { ConnectedPanel } from './ConnectedPanel';
import type { LlmProvider, UserProvider } from '@/domain/types/provider.types';
import type { Model } from '@/domain/types/model.types';

interface ProviderModalProps {
  llmProvider: LlmProvider | null;
  userProvider: UserProvider | null;
  models: Model[];
  open: boolean;
  onClose: () => void;

  /* Disconnect flow */
  disconnecting: boolean;
  disconnectError: string;
  onDisconnect: () => void;

  /* Connect flow */
  credentialValues: Record<string, string>;
  onCredentialChange: (key: string, value: string) => void;
  connectError: string;
  connecting: boolean;
  onConnect: () => void;

  /* Refresh flow */
  refreshing: boolean;
  onRefresh: () => void;
}

/**
 * Modal dialog for a single LLM provider.
 * Dispatches to DisconnectedPanel or ConnectedPanel based on whether
 * the user has already registered the provider.
 */
export function ProviderModal({
  llmProvider,
  userProvider,
  models,
  open,
  onClose,
  disconnecting,
  disconnectError,
  onDisconnect,
  credentialValues,
  onCredentialChange,
  connectError,
  connecting,
  onConnect,
  refreshing,
  onRefresh,
}: ProviderModalProps) {
  if (!llmProvider) return null;

  const { bg, fg } = providerColor(llmProvider.name);
  const logoUrl     = PROVIDER_LOGO_URLS[llmProvider.name];
  const isMonoBlack = MONO_BLACK_PROVIDERS.has(llmProvider.name);

  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <Dialog.Portal>
        {/* Backdrop */}
        <Dialog.Overlay
          className="fixed inset-0 z-[600] bg-black/55"
          style={{ backdropFilter: 'blur(4px)' }}
        />

        {/* Modal panel — centered, matches Vue ps-modal */}
        <Dialog.Content
          className="
            fixed left-1/2 top-1/2 z-[601] -translate-x-1/2 -translate-y-1/2
            w-[780px] max-w-[calc(100vw-32px)] max-h-[90vh] overflow-hidden
            flex flex-col gap-[18px]
            rounded-[18px] border border-[rgba(255,255,255,0.1)]
            bg-[#212121] p-7
          "
          style={{ boxShadow: '0 24px 60px rgba(0,0,0,0.45)' }}
          aria-describedby={undefined}
        >
          {/* Header — fixed, does not scroll */}
          <div className="flex flex-shrink-0 items-start gap-3.5">
            {/* Logo — same logic as ProviderTile: real SVG or coloured initial */}
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={llmProvider.name}
                className={cn('h-9 w-9 flex-shrink-0 rounded-[8px] object-contain', isMonoBlack && 'invert')}
              />
            ) : (
              <div
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[8px] text-base font-bold"
                style={{ background: bg, color: fg }}
                aria-hidden="true"
              >
                {providerInitial(llmProvider.name)}
              </div>
            )}

            <div className="flex flex-1 min-w-0 flex-col gap-0.5">
              <Dialog.Title className="text-base font-bold text-[#ececea] m-0">
                {llmProvider.displayName}
              </Dialog.Title>
              <Dialog.Description className="text-[12px] text-[#737373] m-0">
                {userProvider ? 'Manage your connected provider.' : 'Enter your credentials to connect.'}
              </Dialog.Description>
            </div>

            <Dialog.Close
              className="flex-shrink-0 rounded-md px-1.5 py-0.5 text-base text-[#737373] border-none bg-transparent cursor-pointer transition-colors duration-150 hover:text-[#ececea] hover:bg-[rgba(255,255,255,0.07)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-ring)]"
              aria-label="Close"
            >
              ✕
            </Dialog.Close>
          </div>

          {/* Body */}
          {userProvider ? (
            <ConnectedPanel
              userProvider={userProvider}
              models={models}
              disconnecting={disconnecting}
              error={disconnectError}
              refreshing={refreshing}
              onDisconnect={onDisconnect}
              onRefresh={onRefresh}
              onClose={onClose}
            />
          ) : (
            <ProviderConnectForm
              credentialKind={llmProvider.credentialKind}
              values={credentialValues}
              onValuesChange={onCredentialChange}
              error={connectError}
              connecting={connecting}
              onConnect={onConnect}
            />
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

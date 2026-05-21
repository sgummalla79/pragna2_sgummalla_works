import { Button } from '@/presentation/components/ui/Button';
import { Input } from '@/presentation/components/ui/Input';
import { PasswordInput } from '@/presentation/components/ui/PasswordInput';
import { Textarea } from '@/presentation/components/ui/Textarea';
import { Label } from '@/presentation/components/ui/Label';
import { Separator } from '@/presentation/components/ui/Separator';
import { Sidebar } from '@/presentation/components/ui/Sidebar/Sidebar';
import { ProviderTile } from '@/presentation/views/settings/ProvidersView/ProviderTile';
import { ROUTES } from '@/constants/routes';
import type { SidebarItemConfig } from '@/presentation/components/ui/Sidebar/types';
import type { LlmProvider } from '@/domain/types/provider.types';

// ── Sample data for showcase ──────────────────────────────────────────────────

const DEMO_NAV: SidebarItemConfig[] = [
  { type: 'back',    to: ROUTES.SETTINGS, label: 'Back to Settings' },
  { type: 'divider' },
  { type: 'section', label: 'AI Setup' },
  { type: 'nav', to: ROUTES.SETTINGS_PROVIDERS, icon: <NavIcon d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />, label: 'Providers' },
  { type: 'nav', to: ROUTES.SETTINGS_PROVIDERS, icon: <NavIcon d="M3 3h18v14H3z M8 21h8M12 17v4" />,   label: 'Models' },
  { type: 'section', label: 'Workflows' },
  { type: 'nav', to: ROUTES.SETTINGS_FLOWS,  icon: <NavIcon d="M6 6m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0M18 18m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0M6 18m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0M6 9v6" />, label: 'Flows' },
];

const DEMO_PROVIDERS: { llmProvider: LlmProvider; connected: boolean }[] = [
  { llmProvider: { id: '1', name: 'anthropic',  displayName: 'Anthropic',  credentialKind: 'api_key',         enabled: true }, connected: true  },
  { llmProvider: { id: '2', name: 'openai',     displayName: 'OpenAI',     credentialKind: 'api_key',         enabled: true }, connected: false },
  { llmProvider: { id: '3', name: 'google',     displayName: 'Google',     credentialKind: 'api_key',         enabled: true }, connected: false },
  { llmProvider: { id: '4', name: 'bedrock',    displayName: 'AWS Bedrock', credentialKind: 'aws_credentials', enabled: true }, connected: false },
  { llmProvider: { id: '5', name: 'groq',       displayName: 'Groq',       credentialKind: 'api_key',         enabled: true }, connected: true  },
  { llmProvider: { id: '6', name: 'vertexai',   displayName: 'Vertex AI',  credentialKind: 'gcp_credentials', enabled: true }, connected: false },
];

/**
 * Design system showcase page.
 * Renders every reusable UI component so the full visual library can be
 * reviewed in one place without navigating through the app.
 * Route: /ui
 */
export default function UIFrameworkView() {
  return (
    <div style={{ background: '#282828', minHeight: '100vh', padding: '40px 48px', display: 'flex', flexDirection: 'column', gap: 56 }}>

      <div>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: '#ececea', margin: '0 0 6px' }}>
          UI Framework
        </h1>
        <p style={{ fontSize: 13, color: '#737373', margin: 0 }}>
          All reusable components in one place. Metadata changes — styling never does.
        </p>
      </div>

      {/* ── Buttons ──────────────────────────────────────────────────────────── */}
      <Section title="Buttons">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          <Button variant="default">Primary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="link">Link</Button>
          <Button variant="default" disabled>Disabled</Button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginTop: 12 }}>
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
        </div>
      </Section>

      <Separator className="bg-[rgba(255,255,255,0.08)]" />

      {/* ── Form Inputs ──────────────────────────────────────────────────────── */}
      <Section title="Form Inputs">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Label htmlFor="demo-text">Text input</Label>
            <Input id="demo-text" placeholder="Enter text…" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Label htmlFor="demo-password">Password input</Label>
            <PasswordInput id="demo-password" placeholder="sk-ant-…" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Label htmlFor="demo-error">Input with error state</Label>
            <Input id="demo-error" placeholder="Invalid value" className="border-[#ef4444]" />
            <p role="alert" style={{ fontSize: 12, color: '#ef4444', margin: 0 }}>This field is required.</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Label htmlFor="demo-textarea">Textarea (multiline)</Label>
            <Textarea
              id="demo-textarea"
              placeholder='{ "type": "service_account", … }'
              rows={4}
            />
          </div>
        </div>
      </Section>

      <Separator className="bg-[rgba(255,255,255,0.08)]" />

      {/* ── Provider Tiles ───────────────────────────────────────────────────── */}
      <Section title="Provider Tiles">
        <p style={{ fontSize: 12, color: '#737373', marginBottom: 16 }}>
          Green border = connected · Red border = not connected · Copper on hover
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 14 }}>
          {DEMO_PROVIDERS.map(({ llmProvider, connected }) => (
            <ProviderTile
              key={llmProvider.id}
              llmProvider={llmProvider}
              connected={connected}
              onClick={() => {}}
            />
          ))}
        </div>
      </Section>

      <Separator className="bg-[rgba(255,255,255,0.08)]" />

      {/* ── Sidebar ──────────────────────────────────────────────────────────── */}
      <Section title="Sidebar Menu Styles">
        <p style={{ fontSize: 12, color: '#737373', marginBottom: 16 }}>
          Each menu style is a separate component. Items are passed as config — styling never changes.
        </p>
        <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {/* Live sidebar panel (always-open demo) */}
          <div style={{ width: 240, borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
            <Sidebar
              items={DEMO_NAV}
              isOpen
              onClose={() => {}}
              label="Demo sidebar"
              width={240}
            />
          </div>

          {/* Style legend */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <StyleChip label="back item" description="Copper chevron · takes user back" />
            <StyleChip label="divider"   description="Thin white/8% separator rule" />
            <StyleChip label="section"   description="10px uppercase grey group label" />
            <StyleChip label="nav item"  description="NavLink · copper active state · hover tint" />
          </div>
        </div>
      </Section>

    </div>
  );
}

// ── Local helpers ─────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: '#ececea', margin: '0 0 20px' }}>{title}</h2>
      {children}
    </section>
  );
}

function StyleChip({ label, description }: { label: string; description: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{
        padding: '2px 10px', borderRadius: 99,
        fontSize: 11, fontWeight: 600,
        background: 'rgba(201,112,64,0.12)',
        border: '1.5px solid rgba(201,112,64,0.3)',
        color: '#c97040', whiteSpace: 'nowrap',
      }}>
        {label}
      </span>
      <span style={{ fontSize: 12, color: '#737373' }}>{description}</span>
    </div>
  );
}

function NavIcon({ d }: { d: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

import { describe, it, expect } from 'vitest';
import { STARTER_FLOW_YAML } from '@/presentation/views/settings/FlowEditorView/starterYaml';

describe('STARTER_FLOW_YAML — A+D slash exposure pre-fill (2026-05-27)', () => {
  it('declares slash exposure default-on so a new flow is slash-invocable on first save', () => {
    expect(STARTER_FLOW_YAML).toMatch(/^exposed_as_slash:\s*true$/m);
  });

  it('pre-fills slash_api_name matching the api_name', () => {
    const apiLine = STARTER_FLOW_YAML.match(/^api_name:\s*([\w-]+)$/m);
    const slashLine = STARTER_FLOW_YAML.match(/^slash_api_name:\s*([\w-]+)$/m);
    expect(apiLine).not.toBeNull();
    expect(slashLine).not.toBeNull();
    // Same kebab name on both lines so the LLM's tool name matches the
    // /slash command name — keeps the contract obvious to authors.
    expect(slashLine![1]).toBe(apiLine![1]);
  });

  it('has a non-empty description (required when exposed_as_slash=true)', () => {
    const descMatch = STARTER_FLOW_YAML.match(/^description:\s*(.+)$/m);
    expect(descMatch).not.toBeNull();
    expect(descMatch![1].trim().length).toBeGreaterThan(0);
  });
});

export type AgentTypeId =
  | 'intake'
  | 'discovery'
  | 'researcher'
  | 'aggregator'
  | 'reviewer'
  | 'approver';

export interface AgentType {
  id: string;
  name: string;
  description: string | null;
  implementationKey: string;
}

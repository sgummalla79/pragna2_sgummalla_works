/** psql via `docker exec` against the throwaway test Postgres container.
 *  Used by tests that need to assert DB state directly (Save round-trip,
 *  prune-on-resave).
 *
 *  Why stdin instead of `-c "..."`: SQL via template literals contains
 *  newlines; JSON.stringify turns them into literal `\n` (backslash + n)
 *  inside the shell-quoted string, which psql sees as a syntax error
 *  (`syntax error at or near "\""`). Stdin avoids the shell escaping
 *  problem entirely.
 *
 *  We also DON'T swallow errors here — surfacing a `docker exec` /
 *  psql failure as a thrown Error is what makes the next bug obvious;
 *  silently returning '' produced a baffling "DB row missing" failure
 *  the first time around. */
import { execSync } from 'node:child_process';

import { PG_CONTAINER, TEST_DB } from './env';

/** Run a psql command (via stdin) and return its raw stdout. Throws on
 *  non-zero exit so test assertions see real errors, not empty strings. */
export function psql(sql: string): string {
  return execSync(`docker exec -i ${PG_CONTAINER} psql -U postgres -d ${TEST_DB} -tA`, {
    encoding: 'utf8',
    input: sql,
  }).trim();
}

/** Parse psql `-tA` output (pipe-separated columns, newline-separated
 *  rows) into row arrays. */
export function psqlRows(sql: string): string[][] {
  const out = psql(sql);
  if (!out) return [];
  return out.split('\n').map((l) => l.split('|'));
}

/** Common assertions wrap-ups. */
export const db = {
  flowCount: () => Number(psql('SELECT COUNT(*) FROM flows;')) || 0,
  userAgentCount: () => Number(psql('SELECT COUNT(*) FROM user_agents;')) || 0,
  agentsForFlow: (flowApiName: string) =>
    psqlRows(
      `SELECT api_name, flow_id::text FROM user_agents
       WHERE flow_id = (SELECT id FROM flows WHERE api_name='${flowApiName}')
       ORDER BY api_name;`,
    ),
  flowNodes: (flowApiName: string) =>
    psqlRows(
      `SELECT node_id FROM flow_nodes
       WHERE flow_id = (SELECT id FROM flows WHERE api_name='${flowApiName}')
       ORDER BY node_id;`,
    ),
};

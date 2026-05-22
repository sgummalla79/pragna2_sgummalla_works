/** One validation error against a YAML flow document (R3.6+). */
export interface YamlError {
  /** Dot/bracket path into the YAML (e.g. 'agents[1].user_model').
   *  Empty when document-level (malformed YAML, top-level type wrong). */
  path: string;
  message: string;
}

/** Response from POST /api/flows/validate-yaml — always 200. */
export interface YamlValidationResult {
  valid: boolean;
  errors: YamlError[];
}

export interface ApiError {
  detail: string;
  status?: number;
}

export interface PaginatedParams {
  limit?: number;
  offset?: number;
}

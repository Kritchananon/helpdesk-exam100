export interface ApiResponse<T> {
  code?: string;
  status?: number;
  message: string;
  data: T;
}

export interface PaginationResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

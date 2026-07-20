// jw.org search API types

export interface SearchResponse {
  layout: string[];
  results: SearchResult[];
  messages: SearchMessage[];
  insight: QueryInsight;
  pagination: Pagination;
  filters: Filter[];
  sorts: Sort[];
}

export interface SearchResult {
  type: string;
  subtype: string;
  links: { 'jw.org': string };
  lank: string;
  context?: string;
  title: string;
  image: { type: string; url: string };
  duration?: string;
  snippet?: string;
  insight: { rank: number; lank: string };
}

export interface SearchMessage {
  type: string;
  message: string;
}

export interface QueryInsight {
  query: string;
  filter: string;
  sort: string;
  offset: number;
  page: number;
  total: { value: number; relation: string };
}

export interface Pagination {
  label: string;
  links: PaginationLink[];
}

export interface PaginationLink {
  type: string;
  label: string;
  link: string;
  selected?: boolean;
}

export interface Filter {
  label: string;
  link: string;
  selected?: boolean;
}

export interface Sort {
  label: string;
  link: string;
  selected?: boolean;
}

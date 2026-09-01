export const DB_CONNECTION_ERROR_MESSAGE = "データベースに接続できません";

export class DbConnectionError extends Error {
  readonly statusCode = 503;

  constructor(message = DB_CONNECTION_ERROR_MESSAGE) {
    super(message);
    this.name = "DbConnectionError";
  }
}

export type ContextItem = {
  id: number;
  title: string;
  body: string;
  tags: string[];
  source_url: string;
  source_last_updated_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateContextItemInput = {
  title: string;
  body: string;
  tags: string[];
  source_url: string;
  source_last_updated_at?: string | null;
};

export type UpdateContextItemInput = Partial<CreateContextItemInput>;

export type ContextItemRow = {
  id: number;
  title: string;
  body: string;
  tags: string[];
  source_url: string;
  source_last_updated_at: string | Date | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string | Date;
  updated_at: string | Date;
};

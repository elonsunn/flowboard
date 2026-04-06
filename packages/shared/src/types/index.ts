// Shared types for FlowBoard

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

// Re-export schema-inferred types so web can import directly from @flowboard/shared
export type {
  CreateWorkspaceInput,
  UpdateWorkspaceInput,
  InviteMemberInput,
  UpdateMemberRoleInput,
} from '../schemas/workspace.schema';

export type {
  CreateProjectInput,
  UpdateProjectInput,
} from '../schemas/project.schema';

export type {
  CreateTaskInput,
  UpdateTaskInput,
  QueryTaskInput,
  ReorderTaskInput,
} from '../schemas/task.schema';

export type { CreateCommentInput } from '../schemas/comment.schema';

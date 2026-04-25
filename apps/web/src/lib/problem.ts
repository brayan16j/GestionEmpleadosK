export interface ProblemError {
  path: string;
  message: string;
}

export interface ProblemEnvelope {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  traceId: string;
  errors?: ProblemError[];
}

export class ApiProblem extends Error {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly detail?: string;
  readonly instance?: string;
  readonly traceId: string;
  readonly errors?: ProblemError[];

  constructor(envelope: ProblemEnvelope) {
    super(envelope.title);
    this.name = "ApiProblem";
    this.type = envelope.type;
    this.title = envelope.title;
    this.status = envelope.status;
    this.detail = envelope.detail;
    this.instance = envelope.instance;
    this.traceId = envelope.traceId;
    this.errors = envelope.errors;
  }
}

// Shared by server code and client components (no server-only imports here).
// Portal roles: Super Admin (from .env), Trainer (this), Student.

export type TrainerDTO = {
  trainerId: string;
  name: string;
  email: string;
  active: boolean;
  added: string;
};

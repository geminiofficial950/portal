// Shared by server code and client components (no server-only imports here).
// Portal roles: Super Admin (from .env), Trainer (this), Student.
import type { FileRef } from "./submission-meta";

export type TrainerDTO = {
  trainerId: string;
  name: string;
  email: string;
  active: boolean;
  added: string;
  photo: FileRef | null; // profile picture, set by Super Admin / Admins
};

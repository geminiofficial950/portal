// Shared by server code and client components (no server-only imports here).
// Admin accounts are made by Super Admin. An Admin can do everything Super Admin can, except change dates
// (unit due dates, a student's own due date, a submission's date) and manage other Admins.

export type AdminDTO = {
  adminId: string; // A001, A002…
  name: string;
  email: string;
  active: boolean;
  added: string;
};

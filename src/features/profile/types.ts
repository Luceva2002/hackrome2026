export type UserRole = 'citizen' | 'manager' | 'admin';

export interface UserProfile {
  email: string;
  displayName: string | null;
  role: UserRole;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  citizen: 'Cittadino',
  manager: 'Gestore di impianto',
  admin: 'Amministratore',
};

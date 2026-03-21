export interface User {
  id: number;
  username: string;
  role: string;
  token: string;
}

export interface AuthConfig {
  allowRegistration: boolean;
  invitesEnabled: boolean;
  turnstileSiteKey: string | null;
}

export interface AuthResponse {
  id: number;
  username: string;
  role: string;
  token: string;
}

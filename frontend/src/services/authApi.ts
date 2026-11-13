import type { AuthMeResponse, AuthResponse, Role } from "@ps02/shared";
import { api } from "./api";

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  role: Role;
  vehicleType?: string;
}

export function loginRequest(email: string, password: string): Promise<AuthResponse> {
  return api.post<AuthResponse>("/auth/login", { email, password });
}

export function registerRequest(payload: RegisterPayload): Promise<AuthResponse> {
  return api.post<AuthResponse>("/auth/register", payload);
}

export function meRequest(): Promise<AuthMeResponse> {
  return api.get<AuthMeResponse>("/auth/me");
}

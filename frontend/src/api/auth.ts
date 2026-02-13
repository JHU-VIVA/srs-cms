import { get, post } from "./client";
import type { User } from "../types";

export async function login(username: string, password: string): Promise<User> {
  const res = await post<{ success: boolean; message: string }>("/auth/login", {
    username,
    password,
  });
  if (!res.success) {
    throw new Error(res.message);
  }
  return getUser();
}

export function logout() {
  return post<{ success: boolean; message: string }>("/auth/logout", {});
}

export function getUser() {
  return get<User>("/auth/user");
}

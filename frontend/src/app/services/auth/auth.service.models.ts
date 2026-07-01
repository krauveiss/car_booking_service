
export interface RegisterRequest {
    username: string,
    password: string
}
export interface AuthResponse {
    id: string,
    username: string,
    token: string,
    accepted: boolean
}

export interface LoginRequest {
    username: string;
    password: string;
}

export interface UserProfile {
    id: number;
    username: string;
    accepted: boolean;
    role: string;
    position: string;
    created_at: string;
}
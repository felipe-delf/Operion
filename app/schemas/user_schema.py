from pydantic import BaseModel
from typing import Optional

class UserCreate(BaseModel):
    email: str
    senha: str
    role: str = "Suporte"

class UserResponse(BaseModel):
    id: int
    email: str
    role: str
    exige_troca_senha: bool

    class Config:
        from_attributes = True

class LoginRequest(BaseModel):
    email: str
    senha: str

class ChangePasswordRequest(BaseModel):
    nova_senha: str

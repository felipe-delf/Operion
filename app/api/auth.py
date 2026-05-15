from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.user import UserModel
from app.schemas.user_schema import LoginRequest, ChangePasswordRequest
from app.core.security import verify_password, create_access_token, get_password_hash

router = APIRouter()

@router.post("/login", tags=["Autenticação"])
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(UserModel).filter(UserModel.email == req.email).first()
    if not user or not verify_password(req.senha, user.senha_hash):
        raise HTTPException(status_code=401, detail="E-mail ou senha inválidos")

    if not user.ativo:
        raise HTTPException(status_code=403, detail="Usuário inativo. Contate o administrador.")

    if user.exige_troca_senha:
        return {
            "require_password_change": True,
            "user_id": user.id,
            "message": "Ação Necessária: Redefina sua senha."
        }

    token = create_access_token({"sub": user.email, "role": user.role, "id": user.id})
    return {
        "access_token": token,
        "token_type": "bearer",
        "role": user.role,
        "email": user.email
    }

@router.post("/mudar_senha/{user_id}", tags=["Autenticação"])
def mudar_senha(user_id: int, req: ChangePasswordRequest, db: Session = Depends(get_db)):
    user = db.query(UserModel).filter(UserModel.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    
    user.senha_hash = get_password_hash(req.nova_senha)
    user.exige_troca_senha = False
    db.commit()

    token = create_access_token({"sub": user.email, "role": user.role, "id": user.id})
    return {
        "access_token": token,
        "token_type": "bearer",
        "role": user.role,
        "email": user.email,
        "message": "Senha atualizada com sucesso!"
    }

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.models.user import UserModel
from app.models.script import ScriptModel
from app.schemas.user_schema import UserCreate, UserResponse, UserUpdate
from app.core.security import get_password_hash
from pydantic import BaseModel

class PermissionsUpdate(BaseModel):
    script_ids: List[int]

router = APIRouter()

@router.get("/", response_model=List[UserResponse], tags=["Admin - Usuários"])
def listar_usuarios(db: Session = Depends(get_db)):
    return db.query(UserModel).all()

@router.post("/", response_model=UserResponse, tags=["Admin - Usuários"])
def criar_usuario(req: UserCreate, db: Session = Depends(get_db)):
    user_db = db.query(UserModel).filter(UserModel.email == req.email).first()
    if user_db:
        raise HTTPException(status_code=400, detail="Este e-mail já está em uso.")
    
    novo_usuario = UserModel(
        email=req.email,
        senha_hash=get_password_hash(req.senha),
        role=req.role,
        exige_troca_senha=True
    )
    db.add(novo_usuario)
    db.commit()
    db.refresh(novo_usuario)
    return novo_usuario

@router.put("/{user_id}/resetar_senha", tags=["Admin - Usuários"])
def resetar_senha(user_id: int, db: Session = Depends(get_db)):
    user = db.query(UserModel).filter(UserModel.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    
    user.senha_hash = get_password_hash("mudar123")
    user.exige_troca_senha = True
    db.commit()
    return {"message": f"Senha de {user.email} resetada para 'mudar123'."}

@router.put("/{user_id}", response_model=UserResponse, tags=["Admin - Usuários"])
def editar_usuario(user_id: int, req: UserUpdate, db: Session = Depends(get_db)):
    user = db.query(UserModel).filter(UserModel.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    
    user.role = req.role
    user.ativo = req.ativo
    db.commit()
    db.refresh(user)
    return user

@router.get("/{user_id}/permissoes", tags=["Admin - Usuários"])
def listar_permissoes(user_id: int, db: Session = Depends(get_db)):
    user = db.query(UserModel).filter(UserModel.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    return [script.id for script in user.scripts_permitidos]

@router.post("/{user_id}/permissoes", tags=["Admin - Usuários"])
def salvar_permissoes(user_id: int, req: PermissionsUpdate, db: Session = Depends(get_db)):
    user = db.query(UserModel).filter(UserModel.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    
    scripts = db.query(ScriptModel).filter(ScriptModel.id.in_(req.script_ids)).all()
    user.scripts_permitidos = scripts
    db.commit()
    return {"message": "Permissões atualizadas com sucesso!"}

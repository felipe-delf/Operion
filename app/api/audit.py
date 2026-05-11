from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.models.audit import AuditRuleModel
from app.schemas.audit_schema import AuditRuleCreate, AuditRuleResponse
from app.core.security import get_current_user

router = APIRouter()

@router.post("/auditoria/", response_model=AuditRuleResponse, tags=["Admin - Auditoria"])
def criar_regra(req: AuditRuleCreate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "Admin":
        raise HTTPException(status_code=403, detail="Apenas admins podem criar regras de auditoria.")
        
    nova_regra = AuditRuleModel(**req.model_dump())
    db.add(nova_regra)
    db.commit()
    db.refresh(nova_regra)
    return nova_regra

@router.get("/auditoria/", response_model=List[AuditRuleResponse], tags=["Admin - Auditoria"])
def listar_regras(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    # Qualquer usuário autenticado pode ler as regras para o Scanner, mas o CRUD da tela é só admin
    return db.query(AuditRuleModel).all()

@router.delete("/auditoria/{regra_id}", tags=["Admin - Auditoria"])
def deletar_regra(regra_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "Admin":
        raise HTTPException(status_code=403, detail="Acesso Negado")
        
    regra = db.query(AuditRuleModel).filter(AuditRuleModel.id == regra_id).first()
    if not regra:
        raise HTTPException(status_code=404, detail="Regra não encontrada")
        
    db.delete(regra)
    db.commit()
    return {"message": "Regra excluída."}

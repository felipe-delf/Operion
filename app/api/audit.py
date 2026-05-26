from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.models.audit import AuditRuleModel, AuditGroupModel
from app.schemas.audit_schema import (
    AuditRuleCreate, AuditRuleUpdate, AuditRuleResponse,
    AuditGroupCreate, AuditGroupUpdate, AuditGroupResponse,
)
from app.core.security import get_current_user

router = APIRouter()


# ══════════════════════════════════════════════════════════════════════════════
#  GRUPOS DE AUDITORIA
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/auditoria/grupos/", response_model=List[AuditGroupResponse], tags=["Admin - Auditoria"])
def listar_grupos(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    return db.query(AuditGroupModel).all()


@router.post("/auditoria/grupos/", response_model=AuditGroupResponse, tags=["Admin - Auditoria"])
def criar_grupo(req: AuditGroupCreate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    if "GERENCIAR_AUDITORIA" not in current_user.get("permissions", ""):
        raise HTTPException(status_code=403, detail="Acesso negado. Você não tem permissão para gerenciar a auditoria.")

    existente = db.query(AuditGroupModel).filter(AuditGroupModel.nome == req.nome).first()
    if existente:
        raise HTTPException(status_code=400, detail="Já existe um grupo com este nome.")

    grupo = AuditGroupModel(nome=req.nome, descricao=req.descricao)
    db.add(grupo)
    db.commit()
    db.refresh(grupo)
    return grupo


@router.put("/auditoria/grupos/{grupo_id}", response_model=AuditGroupResponse, tags=["Admin - Auditoria"])
def editar_grupo(grupo_id: int, req: AuditGroupUpdate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    if "GERENCIAR_AUDITORIA" not in current_user.get("permissions", ""):
        raise HTTPException(status_code=403, detail="Acesso negado. Você não tem permissão para gerenciar a auditoria.")

    grupo = db.query(AuditGroupModel).filter(AuditGroupModel.id == grupo_id).first()
    if not grupo:
        raise HTTPException(status_code=404, detail="Grupo não encontrado.")

    grupo.nome = req.nome
    grupo.descricao = req.descricao
    db.commit()
    db.refresh(grupo)
    return grupo


@router.delete("/auditoria/grupos/{grupo_id}", tags=["Admin - Auditoria"])
def deletar_grupo(grupo_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    if "GERENCIAR_AUDITORIA" not in current_user.get("permissions", ""):
        raise HTTPException(status_code=403, detail="Acesso negado. Você não tem permissão para gerenciar a auditoria.")

    grupo = db.query(AuditGroupModel).filter(AuditGroupModel.id == grupo_id).first()
    if not grupo:
        raise HTTPException(status_code=404, detail="Grupo não encontrado.")

    db.delete(grupo)
    db.commit()
    return {"message": f"Grupo '{grupo.nome}' e todas as suas regras foram excluídos."}


# ══════════════════════════════════════════════════════════════════════════════
#  REGRAS DE AUDITORIA
# ══════════════════════════════════════════════════════════════════════════════

def _enrich_regra(regra: AuditRuleModel) -> dict:
    """Converte o model para dict, adicionando o nome do grupo resolvido."""
    return {
        "id": regra.id,
        "nome": regra.nome,
        "sql_query": regra.sql_query,
        "valor_esperado": regra.valor_esperado,
        "valor_esperado_is_query": regra.valor_esperado_is_query,
        "tipo_alvo": regra.tipo_alvo,
        "grupo_id": regra.grupo_id,
        "grupo_nome": regra.grupo.nome if regra.grupo else None,
    }


@router.post("/auditoria/", tags=["Admin - Auditoria"])
def criar_regra(req: AuditRuleCreate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    if "GERENCIAR_AUDITORIA" not in current_user.get("permissions", ""):
        raise HTTPException(status_code=403, detail="Acesso negado. Você não tem permissão para gerenciar regras de auditoria.")

    nova_regra = AuditRuleModel(**req.model_dump())
    db.add(nova_regra)
    db.commit()
    db.refresh(nova_regra)
    return _enrich_regra(nova_regra)


@router.get("/auditoria/", tags=["Admin - Auditoria"])
def listar_regras(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    regras = db.query(AuditRuleModel).all()
    return [_enrich_regra(r) for r in regras]


@router.get("/auditoria/{regra_id}", tags=["Admin - Auditoria"])
def buscar_regra(regra_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    regra = db.query(AuditRuleModel).filter(AuditRuleModel.id == regra_id).first()
    if not regra:
        raise HTTPException(status_code=404, detail="Regra não encontrada")
    return _enrich_regra(regra)


@router.put("/auditoria/{regra_id}", tags=["Admin - Auditoria"])
def editar_regra(regra_id: int, req: AuditRuleUpdate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    if "GERENCIAR_AUDITORIA" not in current_user.get("permissions", ""):
        raise HTTPException(status_code=403, detail="Acesso negado. Você não tem permissão para gerenciar regras de auditoria.")

    regra = db.query(AuditRuleModel).filter(AuditRuleModel.id == regra_id).first()
    if not regra:
        raise HTTPException(status_code=404, detail="Regra não encontrada")

    regra.nome = req.nome
    regra.sql_query = req.sql_query
    regra.valor_esperado = req.valor_esperado
    regra.valor_esperado_is_query = req.valor_esperado_is_query
    regra.tipo_alvo = req.tipo_alvo
    regra.grupo_id = req.grupo_id

    db.commit()
    db.refresh(regra)
    return _enrich_regra(regra)


@router.delete("/auditoria/{regra_id}", tags=["Admin - Auditoria"])
def deletar_regra(regra_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    if "GERENCIAR_AUDITORIA" not in current_user.get("permissions", ""):
        raise HTTPException(status_code=403, detail="Acesso negado. Você não tem permissão para gerenciar regras de auditoria.")

    regra = db.query(AuditRuleModel).filter(AuditRuleModel.id == regra_id).first()
    if not regra:
        raise HTTPException(status_code=404, detail="Regra não encontrada")

    db.delete(regra)
    db.commit()
    return {"message": "Regra excluída."}

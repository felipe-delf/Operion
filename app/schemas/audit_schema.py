from pydantic import BaseModel
from typing import Optional


# ─── Schemas de Grupos ───────────────────────────────────────────────────────

class AuditGroupCreate(BaseModel):
    nome: str
    descricao: Optional[str] = None

class AuditGroupUpdate(BaseModel):
    nome: str
    descricao: Optional[str] = None

class AuditGroupResponse(BaseModel):
    id: int
    nome: str
    descricao: Optional[str] = None

    class Config:
        from_attributes = True


# ─── Schemas de Regras ───────────────────────────────────────────────────────

class AuditRuleBase(BaseModel):
    nome: str
    sql_query: str
    valor_esperado: str
    valor_esperado_is_query: bool = False   # True → valor_esperado é uma query SQL executada na retaguarda
    tipo_alvo: str                          # "PDV", "SERVIDOR" ou "AMBOS"
    grupo_id: Optional[int] = None

class AuditRuleCreate(AuditRuleBase):
    pass

class AuditRuleUpdate(AuditRuleBase):
    pass

class AuditRuleResponse(AuditRuleBase):
    id: int
    grupo_nome: Optional[str] = None        # Nome do grupo resolvido para exibição no frontend

    class Config:
        from_attributes = True

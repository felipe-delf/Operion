from pydantic import BaseModel, ConfigDict
from typing import Optional


# ─── Schemas de Grupos ───────────────────────────────────────────────────────

class AuditGroupCreate(BaseModel):
    nome: str
    descricao: Optional[str] = None


class AuditGroupUpdate(BaseModel):
    nome: str
    descricao: Optional[str] = None


class AuditGroupResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nome: str
    descricao: Optional[str] = None


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
    model_config = ConfigDict(from_attributes=True)

    id: int
    grupo_nome: Optional[str] = None        # Nome do grupo resolvido para exibição no frontend

from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime

class ScriptBase(BaseModel):
    nome: str
    descricao: Optional[str] = None
    sql_servidor: Optional[str] = None
    sql_pdv: Optional[str] = None
    parametros_exigidos: Optional[List[str]] = []
    publicado: bool = False
    # Trava o alvo de execução (ex: "PDV_ESPECIFICO"). None = usuário escolhe.
    alvo_fixo: Optional[str] = None

class ScriptCreate(ScriptBase):
    pass

class ScriptResponse(ScriptBase):
    id: int

    class Config:
        from_attributes = True

class ScriptExecutionRequest(BaseModel):
    parametros: Dict[str, Any]

# ── Schemas de Log de Execução ────────────────────────────────────────────────

class ExecutionLogResponse(BaseModel):
    id: int
    script_id: Optional[int]
    script_nome: Optional[str]
    usuario_id: Optional[int]
    usuario_email: Optional[str]
    usuario_role: Optional[str]
    loja_id: Optional[str]
    alvo: Optional[str]
    parametros: Optional[Dict[str, Any]]
    job_id: Optional[str]
    status_final: Optional[str]
    executado_em: Optional[datetime]

    class Config:
        from_attributes = True

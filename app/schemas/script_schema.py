from pydantic import BaseModel, ConfigDict
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
    model_config = ConfigDict(from_attributes=True)

    id: int
    criado_por: Optional[str] = None
    modificado_por: Optional[str] = None


class ScriptExecutionRequest(BaseModel):
    parametros: Dict[str, Any]


# ── Schemas de Log de Execução ────────────────────────────────────────────────

class ExecutionLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    script_id: Optional[int] = None
    script_nome: Optional[str] = None
    usuario_id: Optional[int] = None
    usuario_email: Optional[str] = None
    usuario_role: Optional[str] = None
    loja_id: Optional[str] = None
    alvo: Optional[str] = None
    parametros: Optional[Dict[str, Any]] = None
    job_id: Optional[str] = None
    status_final: Optional[str] = None
    executado_em: Optional[datetime] = None

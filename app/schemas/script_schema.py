from pydantic import BaseModel
from typing import List, Optional, Dict, Any

class ScriptBase(BaseModel):
    nome: str
    descricao: Optional[str] = None
    sql_servidor: Optional[str] = None
    sql_pdv: Optional[str] = None
    parametros_exigidos: Optional[List[str]] = []
    publicado: bool = False

class ScriptCreate(ScriptBase):
    pass

class ScriptResponse(ScriptBase):
    id: int

    class Config:
        from_attributes = True

class ScriptExecutionRequest(BaseModel):
    parametros: Dict[str, Any]

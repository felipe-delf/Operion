from pydantic import BaseModel

class AuditRuleBase(BaseModel):
    nome: str
    sql_query: str
    valor_esperado: str
    tipo_alvo: str # "PDV", "SERVIDOR", "AMBOS"

class AuditRuleCreate(AuditRuleBase):
    pass

class AuditRuleResponse(AuditRuleBase):
    id: int
    
    class Config:
        from_attributes = True

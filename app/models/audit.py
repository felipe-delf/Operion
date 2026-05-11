from sqlalchemy import Column, Integer, String
from app.core.database import Base

class AuditRuleModel(Base):
    __tablename__ = "audit_rules"
    
    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String, index=True) # Ex: "Varejo 4.0" (Pode repetir para agrupar regras)
    sql_query = Column(String)                     # Ex: "SELECT ATIVO FROM CONFIG WHERE NOME = 'VAREJO'"
    valor_esperado = Column(String)                # Ex: "S"
    tipo_alvo = Column(String)                     # "PDV", "SERVIDOR" ou "AMBOS"

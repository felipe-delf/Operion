from sqlalchemy import Column, Integer, String, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


class AuditGroupModel(Base):
    """Agrupa regras de auditoria sob um nome, ex: 'Epharma', 'Funcional Card'."""
    __tablename__ = "audit_groups"

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String, unique=True, index=True, nullable=False)  # Ex: "Epharma"
    descricao = Column(String, nullable=True)                       # Descrição opcional do grupo

    regras = relationship("AuditRuleModel", back_populates="grupo", cascade="all, delete-orphan")


class AuditRuleModel(Base):
    __tablename__ = "audit_rules"

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String, index=True)                     # Nome da regra (pode repetir entre grupos)
    sql_query = Column(String)                            # Query executada no PDV/Servidor alvo
    valor_esperado = Column(String)                       # Valor estático OU query SQL da retaguarda
    valor_esperado_is_query = Column(Boolean, default=False)  # Flag: True = valor_esperado é uma query SQL da retaguarda
    tipo_alvo = Column(String)                            # "PDV", "SERVIDOR" ou "AMBOS"
    grupo_id = Column(Integer, ForeignKey("audit_groups.id"), nullable=True)

    grupo = relationship("AuditGroupModel", back_populates="regras")

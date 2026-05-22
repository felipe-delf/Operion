from sqlalchemy import Column, Integer, String, Text, DateTime, JSON
from sqlalchemy.sql import func
from app.models.base import Base


class ExecutionLogModel(Base):
    """
    Registra todas as execuções de scripts realizadas no sistema.
    ⚠️ Apenas Admins têm acesso a esta tabela (segurança e auditoria).

    Campos:
      script_id / script_nome  → qual script foi executado (snapshot do nome)
      usuario_id / usuario_email / usuario_role → quem executou
      loja_id  → qual loja foi afetada
      alvo     → SERVIDOR | TODOS_PDVS | PDV_ESPECIFICO | AMBOS | SERVIDOR_PDV
      parametros → parâmetros enviados (ex: {"caixa": "2"})
      job_id   → UUID do job para cruzar com o Radar ao Vivo
      status_final → pendente | concluido | erro
      executado_em → timestamp automático da execução
    """
    __tablename__ = "execution_logs"

    id            = Column(Integer, primary_key=True, index=True)
    script_id     = Column(Integer, nullable=True)
    script_nome   = Column(String(200), nullable=True)
    usuario_id    = Column(Integer, nullable=True)
    usuario_email = Column(String(200), nullable=True)
    usuario_role  = Column(String(50), nullable=True)
    loja_id       = Column(String(50), nullable=True)
    alvo          = Column(String(50), nullable=True)
    parametros    = Column(JSON, nullable=True)
    job_id        = Column(String(100), nullable=True)
    status_final  = Column(String(50), default="pendente")
    executado_em  = Column(DateTime(timezone=True), server_default=func.now())

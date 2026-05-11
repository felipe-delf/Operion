from sqlalchemy import Column, Integer, String, Text, Boolean, JSON
from app.models.base import Base

class ScriptModel(Base):
    __tablename__ = "scripts"

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String(100), unique=True, index=True, nullable=False)
    descricao = Column(String(255), nullable=True)
    sql_servidor = Column(Text, nullable=True)
    sql_pdv = Column(Text, nullable=True)
    parametros_exigidos = Column(JSON, nullable=True) # Lista de strings, ex: ["loja", "caixa"]
    publicado = Column(Boolean, default=False)

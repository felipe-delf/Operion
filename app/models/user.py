from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Table
from sqlalchemy.orm import relationship
from app.models.base import Base

user_script_access = Table(
    "user_script_access",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("usuarios.id"), primary_key=True),
    Column("script_id", Integer, ForeignKey("scripts.id"), primary_key=True)
)

class UserModel(Base):
    __tablename__ = "usuarios"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(100), unique=True, index=True, nullable=False)
    senha_hash = Column(String(255), nullable=False)
    role = Column(String(50), default="Suporte") # 'Admin' ou 'Suporte'
    exige_troca_senha = Column(Boolean, default=True)

    scripts_permitidos = relationship("ScriptModel", secondary=user_script_access)

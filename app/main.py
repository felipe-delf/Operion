import os
from dotenv import load_dotenv

# Carrega as variáveis de ambiente antes de tudo
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.database import create_tables, SessionLocal
from app.core.security import get_password_hash

from app.models.user import UserModel
from app.models.audit import AuditRuleModel, AuditGroupModel  # Garante criação das tabelas audit_rules e audit_groups
from app.models.agent import PcStatusSnapshot  # Garante que a tabela seja criada

from app.api.auth import router as auth_router
from app.api.users import router as users_router
from app.api.audit import router as audit_router
from app.api.agent import router as agent_router
from app.api.routes import router as scripts_router

# Cria todas as tabelas no SQLite ao iniciar
create_tables()

# Popula banco com Super Admin se não existir
db = SessionLocal()
if not db.query(UserModel).filter(UserModel.email == "admin@promofarma").first():
    super_admin = UserModel(
        email="admin@promofarma",
        senha_hash=get_password_hash("Promo@25"),
        role="Admin",
        exige_troca_senha=False
    )
    db.add(super_admin)
    db.commit()
db.close()

app = FastAPI(
    title="Parametrização PBMS API",
    description="API Core para o Gerenciador de Automações, Parametrizações e Monitor de PCs",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router,    prefix="/api/auth")
app.include_router(users_router,   prefix="/api/usuarios")
app.include_router(audit_router,   prefix="/api")
app.include_router(agent_router,   prefix="/api")
app.include_router(scripts_router, prefix="/api")


@app.get("/")
def root():
    return {"message": "API PromoSync v2.0 Online. Acesse /docs para a documentação interativa."}

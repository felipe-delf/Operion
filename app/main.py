import os
from dotenv import load_dotenv

# Carrega as variáveis de ambiente antes de tudo
load_dotenv()

from fastapi import FastAPI
from app.api.routes import router as scripts_router
from app.api.auth import router as auth_router
from app.api.users import router as users_router
from app.api.audit import router as audit_router
from app.core.database import create_tables, SessionLocal
from app.models.user import UserModel
from app.models.audit import AuditRuleModel
from app.core.security import get_password_hash
from fastapi.middleware.cors import CORSMiddleware
from app.core.database import create_tables
from fastapi.middleware.cors import CORSMiddleware

# Cria as tabelas no SQLite ao iniciar
create_tables()

# Popular banco com Super Admin se não existir
db = SessionLocal()
if not db.query(UserModel).filter(UserModel.email == "felipe.barbosa@promofarma.com.br").first():
    super_admin = UserModel(
        email="felipe.barbosa@promofarma.com.br",
        senha_hash=get_password_hash("Fdh3490193@"),
        role="Admin",
        exige_troca_senha=False
    )
    db.add(super_admin)
    db.commit()
db.close()

app = FastAPI(
    title="Parametrização PBMS API",
    description="API Core para o Gerenciador de Automações e Parametrizações",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api/auth")
app.include_router(users_router, prefix="/api/usuarios")
app.include_router(audit_router, prefix="/api")
app.include_router(scripts_router, prefix="/api")

@app.get("/")
def root():
    return {"message": "API de Parametrização Online. Acesse /docs para visualizar a documentação interativa (Swagger)."}

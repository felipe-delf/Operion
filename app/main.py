import os
from dotenv import load_dotenv

# Carrega as variáveis de ambiente antes de tudo
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.database import create_tables, SessionLocal
from app.core.security import get_password_hash

from app.models.user import UserModel
from app.models.user_group import UserGroupModel # Garante criação da tabela de grupos
from app.models.audit import AuditRuleModel, AuditGroupModel  # Garante criação das tabelas audit_rules e audit_groups
from app.models.agent import PcStatusSnapshot  # Garante que a tabela seja criada
from app.models.execution_log import ExecutionLogModel  # Garante criação da tabela de logs de execução

from app.api.auth import router as auth_router
from app.api.users import router as users_router
from app.api.audit import router as audit_router
from app.api.agent import router as agent_router
from app.api.routes import router as scripts_router

# Cria todas as tabelas no SQLite ao iniciar
create_tables()

# Popula banco e garante pelo menos um administrador ativo (Failsafe Auto-Recovery)
db = SessionLocal()
try:
    # ── 1. Semente de Grupos de Permissões Nativos ─────────────────────────────
    grupos_seed = [
        {
            "nome": "Administradores",
            "descricao": "Administração total da TI, infraestrutura, acessos e execução de scripts",
            "permissoes": "VER_DASHBOARD,EXECUTAR_SCRIPT,GERENCIAR_COFRE,GERENCIAR_AUDITORIA,VER_LOGS,EXECUTAR_BROADCAST,GERENCIAR_EQUIPE"
        },
        {
            "nome": "Desenvolvedor",
            "descricao": "Homologação de scripts SQL, consulta de logs e visualização de monitoramento",
            "permissoes": "VER_DASHBOARD,GERENCIAR_COFRE,VER_LOGS,EXECUTAR_SCRIPT"
        },
        {
            "nome": "Suporte N2",
            "descricao": "Suporte de nível intermediário com permissões de execução pontual e auditoria",
            "permissoes": "VER_DASHBOARD,EXECUTAR_SCRIPT,VER_LOGS,GERENCIAR_AUDITORIA"
        },
        {
            "nome": "Suporte N1",
            "descricao": "Suporte de nível básico com permissão de monitoramento em modo leitura",
            "permissoes": "VER_DASHBOARD"
        }
    ]

    for g_data in grupos_seed:
        grupo_db = db.query(UserGroupModel).filter(UserGroupModel.nome == g_data["nome"]).first()
        if not grupo_db:
            print(f"[SEED] Criando grupo padrão: {g_data['nome']}...")
            novo_g = UserGroupModel(
                nome=g_data["nome"],
                descricao=g_data["descricao"],
                permissoes=g_data["permissoes"]
            )
            db.add(novo_g)
    db.commit()

    # Busca o grupo de TI para usar no failsafe
    grupo_ti = db.query(UserGroupModel).filter(UserGroupModel.nome == "Administradores").first()
    grupo_ti_id = grupo_ti.id if grupo_ti else None

    grupo_n2 = db.query(UserGroupModel).filter(UserGroupModel.nome == "Suporte N2").first()
    grupo_n2_id = grupo_n2.id if grupo_n2 else None

    # Migração automática de legado: Vincula todos os usuários antigos sem grupo_id aos novos grupos
    usuarios_sem_grupo = db.query(UserModel).filter(UserModel.grupo_id == None).all()
    if usuarios_sem_grupo:
        print(f"[SEED] [MIGRAÇÃO] Vinculando {len(usuarios_sem_grupo)} usuários sem grupo aos grupos dinâmicos...")
        for u in usuarios_sem_grupo:
            if u.role == "Admin":
                u.grupo_id = grupo_ti_id
            else:
                u.grupo_id = grupo_n2_id
        db.commit()

    # Verificação de segurança: há algum administrador ativo no sistema?
    admin_ativo = db.query(UserModel).filter(
        UserModel.role == "Admin",
        UserModel.ativo == True
    ).first()


    if not admin_ativo:
        print("[AVISO] [ADMIN FAILSAFE] Nenhum administrador ativo encontrado no banco! Criando/Reativando o super admin padrão...")
        admin_padrao = db.query(UserModel).filter(UserModel.email == "admin@empresa.com").first()
        if admin_padrao:
            # Reativa e reseta as credenciais do admin padrão
            admin_padrao.role = "Admin"
            admin_padrao.grupo_id = grupo_ti_id
            admin_padrao.ativo = True
            admin_padrao.senha_hash = get_password_hash("Admin@123")
            admin_padrao.exige_troca_senha = False
            print("[AVISO] [ADMIN FAILSAFE] Administrador padrão 'admin@empresa.com' reativado com a senha padrão 'Admin@123' e grupo Administradores.")
        else:
            # Cria o admin padrão do zero
            admin_padrao = UserModel(
                email="admin@empresa.com",
                senha_hash=get_password_hash("Admin@123"),
                role="Admin",
                grupo_id=grupo_ti_id,
                ativo=True,
                exige_troca_senha=False
            )
            db.add(admin_padrao)
            print("[AVISO] [ADMIN FAILSAFE] Administrador padrão 'admin@empresa.com' criado do zero com a senha padrão 'Admin@123' e grupo Administradores.")
        db.commit()

except Exception as e:
    print(f"[ERRO] [ADMIN FAILSAFE] Falha ao executar o failsafe de administrador: {e}")
    db.rollback()
finally:
    db.close()

app = FastAPI(
    title="Argus API",
    description="API para o Gerenciador de Automações, Parametrizações e Monitor de Lojas",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex="https?://.*",
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
    return {"message": "API Argus v2.0 Online. Acesse /docs para a documentação interativa."}

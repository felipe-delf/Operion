from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.models.script import ScriptModel
from app.models.user import UserModel
from app.schemas.script_schema import ScriptCreate, ScriptResponse
from app.core.security import get_current_user
from app.services.worker import run_script_task, ACTIVE_JOBS, OdbcWorker
import uuid

router = APIRouter()

@router.post("/scripts/", response_model=ScriptResponse, tags=["Admin - Scripts"])
def criar_script(script: ScriptCreate, db: Session = Depends(get_db)):
    db_script = db.query(ScriptModel).filter(ScriptModel.nome == script.nome).first()
    if db_script:
        raise HTTPException(status_code=400, detail="Script com este nome já existe.")
    
    novo_script = ScriptModel(**script.model_dump())
    db.add(novo_script)
    db.commit()
    db.refresh(novo_script)
    return novo_script

@router.get("/scripts/", response_model=List[ScriptResponse], tags=["Usuários e Admin - Scripts"])
def listar_scripts(apenas_publicados: bool = False, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    user = db.query(UserModel).filter(UserModel.id == current_user["id"]).first()
    
    if current_user["role"] == "Admin":
        query = db.query(ScriptModel)
        if apenas_publicados:
            query = query.filter(ScriptModel.publicado == True)
        return query.all()
    else:
        # Se for suporte, retorna apenas os scripts publicados E que ele tem permissão
        if user and user.scripts_permitidos:
            scripts_permitidos_ids = [s.id for s in user.scripts_permitidos]
            return db.query(ScriptModel).filter(ScriptModel.id.in_(scripts_permitidos_ids), ScriptModel.publicado == True).all()
        return []

@router.get("/scripts/{script_id}", response_model=ScriptResponse, tags=["Usuários e Admin - Scripts"])
def buscar_script(script_id: int, db: Session = Depends(get_db)):
    script = db.query(ScriptModel).filter(ScriptModel.id == script_id).first()
    if not script:
        raise HTTPException(status_code=404, detail="Script não encontrado")
    return script

@router.put("/scripts/{script_id}", response_model=ScriptResponse, tags=["Admin - Scripts"])
def atualizar_script(script_id: int, req: ScriptCreate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "Admin":
        raise HTTPException(status_code=403, detail="Apenas administradores podem editar scripts")
        
    script = db.query(ScriptModel).filter(ScriptModel.id == script_id).first()
    if not script:
        raise HTTPException(status_code=404, detail="Script não encontrado")
        
    script.nome = req.nome
    script.descricao = req.descricao
    script.sql_servidor = req.sql_servidor
    script.sql_pdv = req.sql_pdv
    script.parametros_exigidos = req.parametros_exigidos
    script.publicado = req.publicado
    
    db.commit()
    db.refresh(script)
    return script

@router.delete("/scripts/{script_id}", tags=["Admin - Scripts"])
def deletar_script(script_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "Admin":
        raise HTTPException(status_code=403, detail="Apenas administradores podem deletar scripts")
        
    script = db.query(ScriptModel).filter(ScriptModel.id == script_id).first()
    if not script:
        raise HTTPException(status_code=404, detail="Script não encontrado")
        
    db.delete(script)
    db.commit()
    return {"message": "Script deletado com sucesso"}

@router.get("/lojas/", tags=["Dashboard e Lojas"])
def listar_lojas(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    try:
        worker = OdbcWorker()
        conn = worker.connect_retaguarda()
        cursor = conn.cursor()
        query = """
        SELECT L.LOJA, L.NOME_RESUMIDO, P.INSCRICAO_FEDERAL
        FROM LOJAS L WITH(NOLOCK)
        LEFT JOIN PESSOAS_JURIDICAS P WITH(NOLOCK) ON P.ENTIDADE = L.LOJA
        WHERE L.ATIVA = 'S'
        ORDER BY L.LOJA
        """
        cursor.execute(query)
        rows = cursor.fetchall()
        conn.close()
        
        lojas = [{"id": int(r[0]), "nome": r[1], "cnpj": str(r[2]).strip() if r[2] else "N/D"} for r in rows]
        return lojas
    except Exception as e:
        print(f"Erro ao buscar lojas: {e}")
        # Retorna lista vazia ou erro
        return []

from app.services.worker import run_store_scan
from app.models.audit import AuditRuleModel

@router.get("/lojas/{loja_id}/status", tags=["Dashboard e Monitor"])
def status_loja(loja_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    try:
        regras = db.query(AuditRuleModel).all()
        resultado = run_store_scan(loja_id, regras)
        return resultado
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/execucoes/", tags=["Execução ODBC"])
def executar_script(req: dict, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    script_id = req.get("script_id")
    loja_id = req.get("loja_id")
    alvo = req.get("alvo")
    parametros = req.get("parametros", {})
    
    script = db.query(ScriptModel).filter(ScriptModel.id == script_id).first()
    if not script:
        raise HTTPException(status_code=404, detail="Script não encontrado no Cofre")
    
    # Validação de Segurança
    if current_user["role"] != "Admin":
        user = db.query(UserModel).filter(UserModel.id == current_user["id"]).first()
        scripts_permitidos = [s.id for s in user.scripts_permitidos]
        if script_id not in scripts_permitidos:
            raise HTTPException(status_code=403, detail="Você não tem permissão para rodar este script")
            
    job_id = str(uuid.uuid4())
    
    # Inicia o Worker em Background
    background_tasks.add_task(
        run_script_task,
        job_id=job_id,
        script_nome=script.nome,
        sql_servidor=script.sql_servidor,
        sql_pdv=script.sql_pdv,
        loja_id=loja_id,
        alvo=alvo,
        parametros=parametros
    )
    
    return {"status": "sucesso", "job_id": job_id, "message": f"Script enviado para a fila."}

@router.get("/execucoes/{job_id}/status", tags=["Execução ODBC"])
def status_execucao(job_id: str):
    if job_id not in ACTIVE_JOBS:
        raise HTTPException(status_code=404, detail="Job não encontrado")
    return ACTIVE_JOBS[job_id]

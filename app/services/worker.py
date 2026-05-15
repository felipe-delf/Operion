import pyodbc
import concurrent.futures
import time
import socket

ACTIVE_JOBS = {}

class WorkerExecutionError(Exception):
    pass

class OdbcWorker:
    def __init__(self):
        import os
        self.retaguarda_ip = os.getenv('RETAGUARDA_IP', '10.10.0.3')
        self.retaguarda_db = os.getenv('RETAGUARDA_DB', 'PBS_PROMOFARMA_DADOS')
        self.user = os.getenv('RETAGUARDA_USER', 'promofarma.felipe.barbosa')
        self.password = os.getenv('RETAGUARDA_PWD', 'Fdh3490193@')
        
        self.lojas_uid = os.getenv('LOJAS_UID', 'SA')
        self.lojas_pwd = os.getenv('LOJAS_PWD', 'ERPM')

    def connect_retaguarda(self):
        try:
            conn = pyodbc.connect(
                f'DRIVER={{SQL Server Native Client 11.0}};'
                f'SERVER={self.retaguarda_ip};'
                f'DATABASE={self.retaguarda_db};'
                f'UID={self.user};'
                f'PWD={self.password}',
                timeout=5
            )
            return conn
        except Exception as e:
            # Fallback for standard SQL Server Driver if Native Client is missing
            try:
                conn = pyodbc.connect(
                    f'DRIVER={{SQL Server}};'
                    f'SERVER={self.retaguarda_ip};'
                    f'DATABASE={self.retaguarda_db};'
                    f'UID={self.user};'
                    f'PWD={self.password}',
                    timeout=5
                )
                return conn
            except Exception as inner_e:
                print(f"❌ [WORKER] Erro ao conectar na Retaguarda: {inner_e}")
                raise WorkerExecutionError(f"Falha de conexão com a Retaguarda: {inner_e}")

    def get_store_info(self, loja_id):
        print(f"🔍 [WORKER] Buscando dados da loja {loja_id} na Retaguarda...")
        conn = self.connect_retaguarda()
        cursor = conn.cursor()
        
        # Busca o IP do Servidor da Loja
        cursor.execute(f"SELECT IP_SERVIDOR_LOJA FROM LOJAS WHERE LOJA = {loja_id}")
        row = cursor.fetchone()
        
        if not row:
            conn.close()
            raise WorkerExecutionError(f"Loja {loja_id} não encontrada na Retaguarda.")
            
        ip_servidor = row[0]
        
        # Busca os PDVs atrelados à Loja
        cursor.execute(f"SELECT B.CAIXA, B.IP FROM LOJAS A INNER JOIN LOJAS_PDV B ON B.REGISTRO = A.REGISTRO WHERE A.LOJA = {loja_id}")
        pdvs = [{"caixa": int(r[0]), "ip": r[1]} for r in cursor.fetchall()]
        
        conn.close()
        print(f"✅ [WORKER] Dados da loja {loja_id} encontrados. Servidor: {ip_servidor}, PDVs: {len(pdvs)}")
        return {"ip_servidor": ip_servidor, "pdvs": pdvs}

    def execute_sql(self, ip_alvo, base, sql, timeout=5):
        print(f"⚡ [WORKER] Tentando conectar no banco {base} do IP: {ip_alvo}...")
        
        def _connect_and_run():
            conn = pyodbc.connect(
                f'DRIVER={{SQL Server}};'
                f'SERVER={ip_alvo};'
                f'DATABASE={base};'
                f'UID={self.lojas_uid};'
                f'PWD={self.lojas_pwd};'
                f'LoginTimeout={timeout};',
                timeout=timeout
            )
            cursor = conn.cursor()
            cursor.execute(sql)
            conn.commit()
            conn.close()

        executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)
        future = executor.submit(_connect_and_run)
        try:
            future.result(timeout=timeout + 5) # Dá uma margem pro tempo de execução do script
            print(f"✅ [WORKER] Script executado com sucesso no alvo: {ip_alvo}")
        except concurrent.futures.TimeoutError:
            print(f"❌ [WORKER] Timeout ao tentar conectar/executar em {ip_alvo}.")
        except Exception as e:
            print(f"❌ [WORKER] Erro SQL em {ip_alvo}: {e}")

    def execute_query(self, ip_alvo, base, sql, timeout=3):
        def _connect_and_run():
            conn = pyodbc.connect(
                f'DRIVER={{SQL Server}};'
                f'SERVER={ip_alvo};'
                f'DATABASE={base};'
                f'UID={self.lojas_uid};'
                f'PWD={self.lojas_pwd};'
                f'LoginTimeout={timeout};',
                timeout=timeout
            )
            cursor = conn.cursor()
            cursor.execute(sql)
            row = cursor.fetchone()
            conn.close()
            return str(row[0]) if row else ""
            
        executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)
        future = executor.submit(_connect_and_run)
        try:
            return future.result(timeout=timeout + 2)
        except Exception as e:
            raise WorkerExecutionError(str(e))

def run_script_task(job_id: str, script_nome: str, sql_servidor: str, sql_pdv: str, loja_id: str, alvo: str, parametros: dict):
    print(f"🚀 [WORKER INICIADO] Job: {job_id} | Script '{script_nome}' | Loja: {loja_id} | Alvo: {alvo}")
    ACTIVE_JOBS[job_id] = {"status": "rodando", "etapas": []}
    
    def update_etapa(nome, status):
        # Busca se a etapa ja existe e atualiza, senao cria
        for e in ACTIVE_JOBS[job_id]["etapas"]:
            if e["nome"] == nome:
                e["status"] = status
                return
        ACTIVE_JOBS[job_id]["etapas"].append({"nome": nome, "status": status})

    parametros = parametros or {}
    parametros["loja"] = loja_id
    parametros["loja_id"] = loja_id

    worker = OdbcWorker()
    
    try:
        update_etapa("Conectando na Retaguarda (10.10.0.3)", "rodando")
        store_info = worker.get_store_info(loja_id)
        update_etapa("Conectando na Retaguarda (10.10.0.3)", "sucesso")
        
        # 1. Se alvo envolver SERVIDOR, roda o SQL do servidor
        if alvo in ["SERVIDOR", "AMBOS"] and sql_servidor:
            etapa_nome = f"Servidor da Loja ({store_info['ip_servidor']})"
            update_etapa(etapa_nome, "rodando")
            
            sql_final = sql_servidor
            for key, val in parametros.items():
                sql_final = sql_final.replace(f"{{{key}}}", str(val))
            
            try:
                worker.execute_sql(store_info["ip_servidor"], "LOJA", sql_final)
                update_etapa(etapa_nome, "sucesso")
            except Exception as e:
                update_etapa(etapa_nome, "erro")
            
        # 2. Se alvo envolver PDVs
        if alvo in ["TODOS_PDVS", "PDV_ESPECIFICO", "AMBOS"] and sql_pdv:
            pdvs_alvo = store_info["pdvs"]
            
            if alvo == "PDV_ESPECIFICO":
                try:
                    c_val = parametros.get("caixa", 0)
                    numero_caixa = int(c_val) if c_val else 0
                except (ValueError, TypeError):
                    numero_caixa = 0
                pdvs_alvo = [p for p in pdvs_alvo if p["caixa"] == numero_caixa]
            
            for pdv in pdvs_alvo:
                etapa_nome = f"PDV Caixa {pdv['caixa']} ({pdv['ip']})"
                update_etapa(etapa_nome, "rodando")
                
                sql_final = sql_pdv.replace("{caixa}", str(pdv["caixa"]))
                for key, val in parametros.items():
                    sql_final = sql_final.replace(f"{{{key}}}", str(val))
                    
                try:
                    worker.execute_sql(pdv["ip"], "PDV", sql_final)
                    update_etapa(etapa_nome, "sucesso")
                except Exception as e:
                    update_etapa(etapa_nome, "erro")
                time.sleep(0.5)

        ACTIVE_JOBS[job_id]["status"] = "concluido"
        print(f"🏁 [WORKER FINALIZADO] Rotina do Script '{script_nome}' concluída.")
    except Exception as e:
        update_etapa("Falha Geral", "erro")
        ACTIVE_JOBS[job_id]["status"] = "erro"
        ACTIVE_JOBS[job_id]["erro_detalhe"] = str(e)
        print(f"❌ [WORKER FATAL] Falha geral no Worker: {e}")

def run_store_scan(loja_id: int, regras: list):
    worker = OdbcWorker()
    store_info = worker.get_store_info(loja_id)
    
    # Pre-processa o "Valor Esperado" de todas as regras
    regras_processadas = []
    for regra in regras:
        esperado = regra.valor_esperado.strip()
        if getattr(regra, "valor_esperado_is_query", False) or esperado.upper().startswith("SELECT"):
            sql_ret = esperado.replace("{loja_id}", str(loja_id)).replace("{loja}", str(loja_id))
            try:
                conn = worker.connect_retaguarda()
                cursor = conn.cursor()
                cursor.execute(sql_ret)
                row = cursor.fetchone()
                conn.close()
                esperado = str(row[0]).strip() if row else "VAZIO_NA_RETAGUARDA"
            except Exception as e:
                esperado = "ERRO_SQL_RETAGUARDA"
                
        regras_processadas.append({
            "grupo_nome": regra.grupo.nome if regra.grupo else regra.nome,
            "grupo_descricao": regra.grupo.descricao if regra.grupo and regra.grupo.descricao else "Verificação de parametrização.",
            "regra_nome": regra.nome,
            "tipo_alvo": regra.tipo_alvo,
            "sql_query": regra.sql_query,
            "valor_esperado": esperado
        })
    
    resultado = {
        "loja_id": loja_id,
        "servidor": {"status": "offline", "parametros": [], "erros": []},
        "pdvs": []
    }
    
    def check_target(ip, is_servidor, caixa_id=None):
        base = "LOJA" if is_servidor else "PDV"
        tipo_alvo_req = "SERVIDOR" if is_servidor else "PDV"
        
        status = "online"
        parametros_ok = []
        erros = []
        
        # Faz um PING rápido na porta 1433 do TCP para não travar o ThreadPool com timeouts longos
        clean_ip = ip.split('\\')[0]
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(1.0)
        try:
            result = sock.connect_ex((clean_ip, 1433))
            sock.close()
            if result != 0:
                return {"ip": ip, "caixa": caixa_id, "status": "offline", "parametros": [], "erros": []}
        except:
            sock.close()
            return {"ip": ip, "caixa": caixa_id, "status": "offline", "parametros": [], "erros": []}
        
        try:
            worker.execute_query(ip, base, "SELECT 1", timeout=3)
        except Exception:
            return {"ip": ip, "caixa": caixa_id, "status": "offline", "parametros": [], "erros": []}
            
        # Agrupar regras por nome do grupo para consolidar em uma unica TAG
        regras_agrupadas = {}
        for regra in regras_processadas:
            if regra["tipo_alvo"] in [tipo_alvo_req, "AMBOS"]:
                nome_g = regra["grupo_nome"]
                if nome_g not in regras_agrupadas:
                    regras_agrupadas[nome_g] = {"descricao": regra["grupo_descricao"], "regras": []}
                regras_agrupadas[nome_g]["regras"].append(regra)
                
        for nome_grupo, data_grupo in regras_agrupadas.items():
            grupo_valido = True
            erros_do_grupo = []
            tooltip_lines = [f"Objetivo: {data_grupo['descricao']}\n", "Regras analisadas:"]
            
            for regra in data_grupo["regras"]:
                tooltip_lines.append(f"• {regra['regra_nome']} (Esp: {regra['valor_esperado']})")
                try:
                    res = worker.execute_query(ip, base, regra["sql_query"], timeout=3)
                    if res.strip().upper() != regra["valor_esperado"].upper():
                        grupo_valido = False
                        erros_do_grupo.append(f"Retornou: {res}")
                except Exception as e:
                    grupo_valido = False
                    erros_do_grupo.append("Erro na Query SQL")
                    
            tooltip = "\n".join(tooltip_lines)
                    
            if grupo_valido:
                parametros_ok.append({"nome": nome_grupo, "tooltip": f"Validações OK:\n{tooltip}"})
            else:
                # Remove itens vazios
                erros_do_grupo = [e for e in set(erros_do_grupo) if e]
                msg_erro = f"{nome_grupo} ({' | '.join(erros_do_grupo)})"
                erros.append({"nome": msg_erro, "tooltip": f"Falha na validação:\n{tooltip}"})
                    
        return {"ip": ip, "caixa": caixa_id, "status": status, "parametros": parametros_ok, "erros": erros}
        
    with concurrent.futures.ThreadPoolExecutor(max_workers=15) as executor:
        futures = []
        futures.append(executor.submit(check_target, store_info["ip_servidor"], True))
        
        for pdv in store_info["pdvs"]:
            futures.append(executor.submit(check_target, pdv["ip"], False, pdv["caixa"]))
            
        for future in concurrent.futures.as_completed(futures):
            res = future.result()
            if res.get("caixa") is None:
                resultado["servidor"] = {
                    "status": res["status"],
                    "parametros": res["parametros"],
                    "erros": res["erros"]
                }
            else:
                resultado["pdvs"].append({
                    "id": res["caixa"],
                    "status": res["status"],
                    "parametros": res["parametros"],
                    "erros": res["erros"]
                })
                
    resultado["pdvs"] = sorted(resultado["pdvs"], key=lambda x: x["id"])
    return resultado


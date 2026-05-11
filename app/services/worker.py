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
        pdvs = [{"caixa": r[0], "ip": r[1]} for r in cursor.fetchall()]
        
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

    worker = OdbcWorker()
    
    try:
        update_etapa("Conectando na Retaguarda (10.10.0.3)", "rodando")
        store_info = worker.get_store_info(loja_id)
        update_etapa("Conectando na Retaguarda (10.10.0.3)", "sucesso")
        
        # 1. Se alvo for SERVIDOR, roda apenas o SQL do servidor
        if alvo == "SERVIDOR" and sql_servidor:
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
            
        # 2. Se alvo for PDV
        if (alvo == "TODOS_PDVS" or alvo == "PDV_ESPECIFICO") and sql_pdv:
            pdvs_alvo = store_info["pdvs"]
            
            if alvo == "PDV_ESPECIFICO":
                numero_caixa = int(parametros.get("caixa", 0))
                pdvs_alvo = [p for p in pdvs_alvo if p["caixa"] == numero_caixa]
            
            for pdv in pdvs_alvo:
                etapa_nome = f"PDV Caixa {pdv['caixa']} ({pdv['ip']})"
                update_etapa(etapa_nome, "rodando")
                
                sql_final = sql_pdv
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
        if esperado.upper().startswith("SELECT"):
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
            "nome": regra.nome,
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
            
        # Agrupar regras por nome para consolidar em uma unica TAG
        regras_agrupadas = {}
        for regra in regras_processadas:
            if regra["tipo_alvo"] in [tipo_alvo_req, "AMBOS"]:
                nome_r = regra["nome"]
                if nome_r not in regras_agrupadas:
                    regras_agrupadas[nome_r] = []
                regras_agrupadas[nome_r].append(regra)
                
        for nome_grupo, lista_regras in regras_agrupadas.items():
            grupo_valido = True
            erros_do_grupo = []
            
            for regra in lista_regras:
                try:
                    res = worker.execute_query(ip, base, regra["sql_query"], timeout=3)
                    if res.strip().upper() != regra["valor_esperado"].upper():
                        grupo_valido = False
                        erros_do_grupo.append(f"Retornou: {res}")
                except Exception as e:
                    grupo_valido = False
                    erros_do_grupo.append("Erro na Query SQL")
                    
            if grupo_valido:
                parametros_ok.append(nome_grupo)
            else:
                # Remove itens vazios
                erros_do_grupo = [e for e in set(erros_do_grupo) if e]
                msg_erro = f"{nome_grupo} ({' | '.join(erros_do_grupo)})"
                erros.append(msg_erro)
                    
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


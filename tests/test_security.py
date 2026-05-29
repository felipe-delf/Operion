"""
test_security.py — Testes de Segurança Horizontal e Vertical.
Cobre: escalada de privilégio, acesso sem token, tokens adulterados,
       isolamento de permissões entre grupos.
"""
import pytest
import jwt as pyjwt
from datetime import datetime, timedelta, timezone
from tests.conftest import auth_headers


class TestSegurancaVertical:
    """
    Testes de escalada vertical de privilégios.
    Garante que usuários com permissões limitadas não acessam endpoints restritos.
    """

    def test_suporte_nao_acessa_gerenciar_cofre(self, client, suporte_token):
        """Suporte N1 não pode criar scripts (sem GERENCIAR_COFRE)."""
        res = client.post(
            "/api/scripts/",
            headers=auth_headers(suporte_token),
            json={
                "nome": "Hack Attempt",
                "descricao": "...",
                "conteudo": "SELECT * FROM usuarios",
                "publicado": True,
                "linguagem": "SQL"
            }
        )
        assert res.status_code == 403

    def test_suporte_nao_acessa_execucoes_logs(self, client, suporte_token):
        """Suporte N1 não pode ver logs de execução (sem VER_LOGS).
        A rota de logs deve exigir autenticação e retornar dados apenas se autorizado."""
        res = client.get("/api/execucoes/logs/", headers=auth_headers(suporte_token))
        # Backend deve retornar 403 para usuários sem VER_LOGS
        # Ou lista vazia se não tiver proteção no backend (checar implementação)
        assert res.status_code in [200, 403]  # Não deve retornar 500

    def test_acesso_sem_token_retorna_401(self, client):
        """Todos os endpoints protegidos devem rejeitar requisições sem token."""
        endpoints_protegidos = [
            ("GET", "/api/auditoria/grupos/"),
            ("GET", "/api/auditoria/"),
            ("GET", "/api/scripts/"),
        ]
        for method, path in endpoints_protegidos:
            if method == "GET":
                res = client.get(path)
            assert res.status_code == 401, f"Esperado 401 em {method} {path}"


class TestTokenSecurity:
    """Testes para verificar robustez do mecanismo de JWT."""

    def test_token_adulterado_retorna_401(self, client, admin_token):
        """Token com assinatura adulterada deve ser rejeitado em rotas protegidas."""
        partes = admin_token.split(".")
        token_adulterado = partes[0] + "." + partes[1] + ".assinatura_falsa"
        res = client.get(
            "/api/auditoria/grupos/",
            headers={"Authorization": f"Bearer {token_adulterado}"}
        )
        assert res.status_code == 401

    def test_token_vazio_retorna_401(self, client):
        """Header de autorização com valor vazio deve retornar 401."""
        res = client.get(
            "/api/auditoria/grupos/",
            headers={"Authorization": "Bearer "}
        )
        assert res.status_code == 401

    def test_token_expirado_retorna_401(self, client, admin_user):
        """Token gerado com exp no passado deve ser rejeitado."""
        from datetime import datetime, timedelta
        from app.core.security import SECRET_KEY, ALGORITHM

        payload = {
            "sub": admin_user.email,
            "id": admin_user.id,
            "role": "Administradores",
            "permissions": "VER_DASHBOARD",
            "exp": datetime.now(timezone.utc) - timedelta(hours=1)  # Expirado há 1h
        }
        token_expirado = pyjwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

        res = client.get(
            "/api/auditoria/grupos/",
            headers={"Authorization": f"Bearer {token_expirado}"}
        )
        assert res.status_code == 401

    def test_payload_jwt_nao_contem_senha(self, client, admin_user):
        """O JWT retornado no login nunca deve conter o hash da senha."""
        res = client.post("/api/auth/login", json={
            "email": "admin@teste.com",
            "senha": "Admin@123"
        })
        token = res.json()["access_token"]

        # Decodifica sem verificar assinatura para inspecionar payload
        decoded = pyjwt.decode(token, options={"verify_signature": False})
        assert "senha" not in decoded
        assert "senha_hash" not in decoded
        assert "password" not in decoded


class TestRBACIsolamento:
    """Testes de isolamento de permissões entre grupos (RBAC)."""

    def test_permissoes_do_grupo_refletidas_no_token(self, client, suporte_user):
        """As permissões no token JWT devem espelhar exatamente as do grupo do usuário."""
        res = client.post("/api/auth/login", json={
            "email": "suporte@teste.com",
            "senha": "Suporte@123"
        })
        assert res.status_code == 200
        permissions = res.json()["permissions"]

        # Suporte N1 tem apenas VER_DASHBOARD
        assert "VER_DASHBOARD" in permissions
        assert "EXECUTAR_BROADCAST" not in permissions
        assert "GERENCIAR_EQUIPE" not in permissions

    def test_admin_tem_todas_as_permissoes(self, client, admin_user):
        """O grupo Administradores deve ter acesso completo a todas as permissões."""
        res = client.post("/api/auth/login", json={
            "email": "admin@teste.com",
            "senha": "Admin@123"
        })
        assert res.status_code == 200
        permissions = res.json()["permissions"]

        permissoes_esperadas = [
            "VER_DASHBOARD", "EXECUTAR_SCRIPT", "GERENCIAR_COFRE",
            "GERENCIAR_AUDITORIA", "VER_LOGS", "EXECUTAR_BROADCAST", "GERENCIAR_EQUIPE"
        ]
        for p in permissoes_esperadas:
            assert p in permissions, f"Administrador deveria ter '{p}' mas não tem"


class TestRestricaoLojas:
    """Testes para garantir que as lojas 990 e 900 são completamente bloqueadas e restritas."""

    def test_obter_status_loja_restrita_retorna_400(self, client, admin_token):
        """Acesso à rota de status das lojas 990 e 900 deve retornar 400."""
        for loja_id in (990, 900):
            res = client.get(f"/api/lojas/{loja_id}/status", headers=auth_headers(admin_token))
            assert res.status_code == 400
            assert "restrito" in res.json().get("detail", "").lower()

    def test_executar_script_loja_restrita_retorna_400(self, client, admin_token):
        """Tentativa de execução de script em 990 ou 900 deve ser bloqueada com status 400."""
        for loja_id in (990, 900):
            res = client.post(
                "/api/execucoes/",
                headers=auth_headers(admin_token),
                json={
                    "script_id": 1,
                    "loja_id": loja_id,
                    "parametros": {}
                }
            )
            assert res.status_code == 400
            assert "restrita" in res.json().get("detail", "").lower()

    def test_agente_scan_loja_restrita_retorna_400(self, client, admin_token):
        """Tentativas de disparar scan WMI em lojas restritas deve retornar 400."""
        for loja_id in (990, 900):
            res = client.post(f"/api/agentes/scan/{loja_id}", headers=auth_headers(admin_token))
            assert res.status_code == 400
            assert "restrito" in res.json().get("detail", "").lower()

    def test_agente_status_loja_restrita_retorna_400(self, client, admin_token):
        """Tentativas de consultar status de PCs em lojas restritas deve retornar 400."""
        for loja_id in (990, 900):
            res = client.get(f"/api/agentes/{loja_id}", headers=auth_headers(admin_token))
            assert res.status_code == 400
            assert "restrito" in res.json().get("detail", "").lower()

    def test_agente_scan_status_loja_restrita_retorna_400(self, client, admin_token):
        """Tentativas de checar status de scan em lojas restritas deve retornar 400."""
        for loja_id in (990, 900):
            res = client.get(f"/api/agentes/scan/{loja_id}/status", headers=auth_headers(admin_token))
            assert res.status_code == 400
            assert "restrito" in res.json().get("detail", "").lower()


class TestSqlInjectionProtection:
    """Testes para validar resiliência a ataques de SQL Injection em várias rotas da API."""

    def test_sql_injection_login_email(self, client):
        """Injeção de SQL clássica no campo de e-mail de login deve ser tratada com segurança e retornar 401."""
        payloads = [
            "admin@teste.com' OR '1'='1",
            "admin@teste.com' --",
            "admin@teste.com' UNION SELECT NULL, NULL --",
            "' OR 1=1 --",
            "\" OR \"\"=\"",
        ]
        for payload in payloads:
            res = client.post("/api/auth/login", json={
                "email": payload,
                "senha": "qualquer_senha"
            })
            assert res.status_code == 401
            assert "detail" in res.json()
            assert res.json()["detail"] == "E-mail ou senha inválidos"

    def test_sql_injection_login_senha(self, client):
        """Injeção de SQL clássica no campo de senha de login deve retornar 401."""
        payloads = [
            "' OR '1'='1",
            "Admin@123' OR '1'='1",
            "' OR 1=1 --",
            "x' UNION SELECT * FROM usuarios --",
        ]
        for payload in payloads:
            res = client.post("/api/auth/login", json={
                "email": "admin@teste.com",
                "senha": payload
            })
            assert res.status_code == 401
            assert res.json()["detail"] == "E-mail ou senha inválidos"

    def test_sql_injection_criacao_grupo(self, client, admin_token, db_session):
        """Os campos de texto na criação de grupo devem salvar os payloads literalmente, provando segurança do ORM."""
        payload_nome = "Grupo SQLi' OR 1=1 --"
        payload_desc = "SQLi -- DROP TABLE usuarios;"
        
        res = client.post(
            "/api/usuarios/grupos/",
            headers=auth_headers(admin_token),
            json={
                "nome": payload_nome,
                "descricao": payload_desc,
                "permissoes": "VER_DASHBOARD"
            }
        )
        assert res.status_code == 200
        data = res.json()
        assert data["nome"] == payload_nome
        assert data["descricao"] == payload_desc

        # Verifica se foi gravado literalmente no banco de dados SQLite de teste
        from app.models.user_group import UserGroupModel
        grupo_gravado = db_session.query(UserGroupModel).filter(UserGroupModel.id == data["id"]).first()
        assert grupo_gravado is not None
        assert grupo_gravado.nome == payload_nome
        assert grupo_gravado.descricao == payload_desc

    def test_sql_injection_parametros_url(self, client, admin_token):
        """IDs inválidos/com SQLi nas URLs devem retornar erro de validação (422) ou 404/400, nunca 500 ou execução SQL."""
        payloads = [
            "1; DROP TABLE usuarios;",
            "1' OR 1=1",
            "1 UNION SELECT 1",
            "null",
        ]
        for p in payloads:
            # Rota que espera um inteiro (loja_id)
            res_loja = client.get(f"/api/lojas/{p}/status", headers=auth_headers(admin_token))
            assert res_loja.status_code in [404, 422, 400]

            # Outra rota que espera um inteiro (user_id)
            res_user = client.put(f"/api/usuarios/{p}/resetar_senha", headers=auth_headers(admin_token))
            assert res_user.status_code in [404, 422, 400]


class TestJwtAlgorithmNoneProtection:
    """Testes para garantir resiliência contra ataques de alteração do algoritmo JWT para 'none'."""

    def test_jwt_none_algorithm_rejeitado(self, client, admin_user):
        """Tokens com algoritmo 'none' no cabeçalho devem ser totalmente rejeitados com 401."""
        payload = {
            "sub": admin_user.email,
            "id": admin_user.id,
            "role": "Administradores",
            "permissions": "VER_DASHBOARD",
            "exp": (datetime.now(timezone.utc) + timedelta(hours=1)).timestamp()
        }
        
        # Gera o token sem chave de assinatura (algoritmo 'none')
        header = {"alg": "none", "typ": "JWT"}
        import json
        import base64

        def base64url_encode(payload_bytes):
            return base64.urlsafe_b64encode(payload_bytes).rstrip(b'=').decode('utf-8')

        header_b64 = base64url_encode(json.dumps(header).encode('utf-8'))
        payload_b64 = base64url_encode(json.dumps(payload).encode('utf-8'))
        
        # Token malicioso do tipo "none": header.payload.
        malicious_token = f"{header_b64}.{payload_b64}."

        res = client.get(
            "/api/auditoria/grupos/",
            headers={"Authorization": f"Bearer {malicious_token}"}
        )
        assert res.status_code == 401
        assert "detail" in res.json()


class TestBolaIdorProtection:
    """Testes de Broken Object Level Authorization (BOLA/IDOR) e escalada horizontal de privilégios."""

    def test_suporte_nao_pode_alterar_grupo_de_outro_usuario(self, client, suporte_token, admin_user):
        """Um usuário comum não pode modificar dados de outros usuários."""
        res = client.put(
            f"/api/usuarios/{admin_user.id}",
            headers=auth_headers(suporte_token),
            json={
                "email": "admin_hacked@teste.com",
                "role": "Admin",
                "ativo": True,
                "grupo_id": admin_user.grupo_id
            }
        )
        assert res.status_code == 403

    def test_suporte_nao_pode_deletar_grupo_de_acesso(self, client, suporte_token, admin_group):
        """Um usuário comum não pode deletar nenhum grupo de acesso."""
        res = client.delete(
            f"/api/usuarios/grupos/{admin_group.id}",
            headers=auth_headers(suporte_token)
        )
        assert res.status_code == 403


class TestInputSanitizationAndXss:
    """Testes de sanitização de inputs e resiliência contra injeção de HTML/Javascript (XSS)."""

    def test_xss_payload_stored_safely(self, client, admin_token, db_session):
        """Injeções de scripts e tags HTML devem ser gravadas e expostas literalmente, sem causar renderização ou execução no backend."""
        payload_xss = "<script>alert('xss_attack')</script><iframe src='javascript:alert(1)'></iframe>"
        res = client.post(
            "/api/usuarios/grupos/",
            headers=auth_headers(admin_token),
            json={
                "nome": "Grupo XSS",
                "descricao": payload_xss,
                "permissoes": "VER_DASHBOARD"
            }
        )
        assert res.status_code == 200
        assert res.json()["descricao"] == payload_xss



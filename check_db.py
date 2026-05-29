import sqlite3

conn = sqlite3.connect('parametrizacao_limpo.db')
cur = conn.cursor()

cur.execute("SELECT nome, permissoes, parent_id FROM user_grupos ORDER BY id")
rows = cur.fetchall()
print('Grupos no banco:')
for r in rows:
    print(f'  {r[0]:25} | parent={r[2]} | {r[1]}')

print('\nUsuarios:')
cur.execute("SELECT email, role, grupo_id, ativo FROM usuarios ORDER BY id")
for r in cur.fetchall():
    print(f'  {r[0]:30} | role={r[1]} | grupo_id={r[2]} | ativo={r[3]}')

conn.close()

from app.core.database import SessionLocal
from app.models.user import UserModel
from app.models.user_group import UserGroupModel

db = SessionLocal()
try:
    grupos = db.query(UserGroupModel).order_by(UserGroupModel.id).all()
    print("Grupos no banco:")
    for g in grupos:
        print(f"  {g.nome:25} | parent={g.parent_id} | {g.permissoes}")

    print("\nUsuarios:")
    usuarios = db.query(UserModel).order_by(UserModel.id).all()
    for u in usuarios:
        print(f"  {u.email:30} | role={u.role} | grupo_id={u.grupo_id} | ativo={u.ativo}")
finally:
    db.close()

import { Users } from './users';
import * as db from '../../utils/db';
import { ResourceNotFoundException } from '../../middlewares/ResourceNotFoundException';

const USERS_TABLE = 'users';
const USERS_ROLES_TABLE = 'users_roles';

export async function fetchAll(): Promise<Users[]> {
  return await db.connection()(USERS_TABLE).select('*').then(mapToModel);
}

export async function create(user: Users): Promise<Users> {
  const { username, password, roles } = user;
  const id: number[] = await db.connection().transaction(async (trx) => {
    const userId: number[] = await trx(USERS_TABLE).insert({
      username,
      password,
    });
    const usersRolePayload = await usersRolesPayload(userId[0], roles);
    await trx(USERS_ROLES_TABLE).insert(usersRolePayload);
    return userId;
  });
  return fetchById(id[0]);
}

export async function validateUser(user: Users) {
  const { username, password } = user;

  const users: Users[] = await db
    .connection()(USERS_TABLE)
    .select('*')
    .where({ username, password })
    .then(mapToModel);

  if (users.length === 0) {
    throw new ResourceNotFoundException(`User not found`);
  }
  return users[0];
}

export async function fetchById(id: number): Promise<Users> {
  const users: Users[] = await db
    .connection()(USERS_TABLE)
    .select('*')
    .where({ id })
    .then(mapToModel);

  if (users.length === 0) {
    throw new ResourceNotFoundException(
      `User resource with given id ${id} not found`
    );
  }
  return users[0];
}

export async function update(id: number, user: Users): Promise<Users> {
  const { username, password, roles } = user;
  await db.connection().transaction(async (trx) => {
    await trx(USERS_TABLE).update({ username, password }).where({ id });
    await trx(USERS_ROLES_TABLE).del().where({ user_id: id });
    const usersRolePayload = await usersRolesPayload(id, roles);
    await trx(USERS_ROLES_TABLE).insert(usersRolePayload);
  });
  return await fetchById(id);
}

export async function remove(id: number): Promise<void> {
  await db.connection().transaction(async (trx) => {
    await trx(USERS_ROLES_TABLE).del().where({ user_id: id });
    await trx(USERS_TABLE).del().where({ id });
  });
}

function mapToModel(users: any[]) {
  const promises = users.map((user) => {
    return db
      .connection()(USERS_ROLES_TABLE)
      .select('roles')
      .join('users', 'users.id', 'users_roles.user_id')
      .where('user_id', user.id)
      .then((roles) => {
        user.roles = roles.map((role) => {
          return role.roles;
        });
        return user;
      });
  });
  return Promise.all(promises);
}

async function usersRolesPayload(id: number, roles: any[]) {
  const rolesPayload: { user_id: number; roles: string }[] = [];
  roles.forEach((r) => {
    const userRoles = {
      user_id: id,
      roles: r,
    };
    rolesPayload.push(userRoles);
  });
  return rolesPayload;
}

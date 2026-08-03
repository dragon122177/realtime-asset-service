import bcrypt from 'bcryptjs';
import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken';
import type { AppConfig } from '../config.js';
import type { Database } from '../database/client.js';
import { roles, type AuthenticatedUser, type Role } from '../domain/types.js';

type UserRow = {
  id: string;
  workspace_id: string;
  email: string;
  password_hash: string;
  display_name: string;
  role: Role;
};

type UserToken = JwtPayload & {
  sub: string;
  workspaceId: string;
  email: string;
  displayName: string;
  role: Role;
  scope?: string;
};

export class AuthService {
  constructor(
    private readonly database: Database,
    private readonly config: AppConfig,
  ) {}

  async login(
    email: string,
    password: string,
  ): Promise<{ token: string; user: AuthenticatedUser }> {
    const result = await this.database.query<UserRow>(
      `SELECT id, workspace_id, email::text, password_hash, display_name, role
       FROM identity.users WHERE email = $1 AND is_active = true LIMIT 2`,
      [email],
    );
    const row = result.rows[0];
    if (result.rowCount !== 1 || !row || !(await bcrypt.compare(password, row.password_hash))) {
      throw new Error('invalid_credentials');
    }
    const user = this.toUser(row);
    return { token: this.signUser(user), user };
  }

  async verify(token: string): Promise<AuthenticatedUser> {
    const payload = jwt.verify(token, this.config.jwtSecret) as UserToken;
    if (
      payload.scope ||
      !payload.sub ||
      typeof payload.workspaceId !== 'string' ||
      !roles.includes(payload.role)
    ) {
      throw new Error('invalid_token');
    }
    return this.resolveActiveUser(payload.sub, payload.workspaceId);
  }

  issueLiveTicket(user: AuthenticatedUser): { ticket: string; expiresInSeconds: number } {
    return {
      ticket: jwt.sign(
        { workspaceId: user.workspaceId, role: user.role, scope: 'live' },
        this.config.jwtSecret,
        { subject: user.id, expiresIn: this.config.liveTicketTtlSeconds },
      ),
      expiresInSeconds: this.config.liveTicketTtlSeconds,
    };
  }

  async verifyLiveTicket(
    ticket: string,
  ): Promise<{ userId: string; workspaceId: string; role: Role }> {
    const payload = jwt.verify(ticket, this.config.jwtSecret) as UserToken;
    if (
      payload.scope !== 'live' ||
      !payload.sub ||
      typeof payload.workspaceId !== 'string' ||
      !roles.includes(payload.role)
    ) {
      throw new Error('invalid_live_ticket');
    }
    const user = await this.resolveActiveUser(payload.sub, payload.workspaceId);
    return { userId: user.id, workspaceId: user.workspaceId, role: user.role };
  }

  private signUser(user: AuthenticatedUser): string {
    return jwt.sign(
      {
        workspaceId: user.workspaceId,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
      },
      this.config.jwtSecret,
      {
        subject: user.id,
        expiresIn: this.config.jwtExpiresIn as SignOptions['expiresIn'],
      },
    );
  }

  private toUser(row: UserRow): AuthenticatedUser {
    return {
      id: row.id,
      workspaceId: row.workspace_id,
      email: row.email,
      displayName: row.display_name,
      role: row.role,
    };
  }

  private async resolveActiveUser(userId: string, workspaceId: string): Promise<AuthenticatedUser> {
    const result = await this.database.query<UserRow>(
      `SELECT id, workspace_id, email::text, password_hash, display_name, role
       FROM identity.users WHERE id = $1 AND workspace_id = $2 AND is_active = true`,
      [userId, workspaceId],
    );
    const row = result.rows[0];
    if (!row) throw new Error('inactive_or_missing_user');
    return this.toUser(row);
  }
}

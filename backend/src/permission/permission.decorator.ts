import { SetMetadata } from '@nestjs/common';

export const RequireRoles = (...roles: number[]) =>
  SetMetadata('permission_config', { roles });

// รองรับหลาย action
export const RequireAction = (...actions: string[]) =>
  SetMetadata('permission_config', { actions });

// รองรับ action เดียว (backward compatibility)
export const RequireSingleAction = (action: string) =>
  SetMetadata('permission_config', { action });

export const RequireRolesOrOwner = (...roles: number[]) =>
  SetMetadata('permission_config', { roles, allowOwner: true });

// รองรับทั้ง roles และ actions
export const RequireRolesOrActions = (config: { roles?: number[], actions?: string[], allowOwner?: boolean }) =>
  SetMetadata('permission_config', config);

// ใช้ OR logic สำหรับหลาย action
export const RequireAnyAction = (...actions: string[]) =>
  SetMetadata('permission_config', { actions, logicType: 'OR' });

// ใช้ AND logic สำหรับหลาย action
export const RequireAllActions = (...actions: string[]) =>
  SetMetadata('permission_config', { actions, logicType: 'AND' });
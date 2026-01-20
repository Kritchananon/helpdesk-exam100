import { Routes } from '@angular/router';
import { AuthLayoutComponent } from './layouts/auth-layout/auth-layout.component';
import { MainLayoutComponent } from './layouts/main-layout/main-layout.component';
import { LoginComponent } from './pages/auth/login/login.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { TicketCreateComponent } from './pages/tickets/ticket-create/ticket-create.component';
import { TicketListComponent } from './pages/tickets/ticket-list/ticket-list.component';
import { TicketDetailComponent } from './pages/tickets/ticket-detail/ticket-detail.component';

// Import Report Components
import { WeeklyReportComponent } from './pages/reports/weekly-report/weekly-report.component';
import { MonthlyReportComponent } from './pages/reports/monthly-report/monthly-report.component';
import { ExportTicketComponent } from './pages/reports/export-ticket/export-ticket.component';

// Import Settings Components
import { GeneralComponent } from './pages/settings/general/general.component';
import { UserAccountComponent } from './pages/settings/user-account/user-account.component';
import { ProjectComponent } from './pages/settings/project/project.component';
import { TicketCategoriesComponent } from './pages/settings/ticket-categories/ticket-categories.component';
import { CustomersComponent } from './pages/settings/customers/customers.component';

// ✅ NEW: Import My Profile Component
import { MyProfileComponent } from './shared/components/my-profile/my-profile.component';

// Import Permission Guards
import { 
  authGuard, 
  adminGuard, 
  supportGuard, 
  userManagementGuard,
  createPermissionGuard
} from './shared/guards/auth.guard';

// Import Permission Enum
import { permissionEnum } from './shared/models/permission.model';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/login',
    pathMatch: 'full'
  },
  
  // ===== Auth Routes (No Guard) =====
  {
    path: '',
    component: AuthLayoutComponent,
    children: [
      {
        path: 'login',
        component: LoginComponent,
        title: 'Login - Support Ticket System'
      }
    ]
  },
  
  // ===== Protected Routes (With Auth Guard) =====
  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [authGuard],
    children: [
      // ===== Dashboard - FIXED: Relaxed permissions =====
      {
        path: 'dashboard',
        component: DashboardComponent,
        canActivate: [authGuard],
        data: {
          // FIXED: Allow any authenticated user to access dashboard
          permissions: [], // No specific permissions required
          requireAllPermissions: false
        },
        title: 'Dashboard - Support Ticket System'
      },

      // ===== ✅ NEW: My Profile Route (All authenticated users can access) =====
      {
        path: 'profile',
        component: MyProfileComponent,
        canActivate: [authGuard],
        data: {
          permissions: [], // No specific permissions required - all authenticated users
          requireAllPermissions: false
        },
        title: 'My Profile - Support Ticket System'
      },
      
      // ===== Ticket Routes - FIXED: More inclusive permissions =====
      {
        path: 'tickets',
        children: [
          {
            path: '',
            component: TicketListComponent,
            canActivate: [authGuard],
            data: {
              // FIXED: Allow users with any ticket-related permission
              permissions: [
                permissionEnum.VIEW_ALL_TICKETS, 
                permissionEnum.VIEW_OWN_TICKETS,
                permissionEnum.CREATE_TICKET,  // Users can access if they can create
                permissionEnum.TRACK_TICKET    // Users can access if they can track
              ],
              requireAllPermissions: false // Any one permission is enough
            },
            title: 'All Tickets - Support Ticket System'
          },
          {
            path: 'my-tickets',
            component: TicketListComponent,
            canActivate: [authGuard],
            data: {
              viewMode: 'own-only',
              // FIXED: Basic user permission
              permissions: [
                permissionEnum.VIEW_OWN_TICKETS,
                permissionEnum.CREATE_TICKET  // If user can create, they should see their tickets
              ],
              requireAllPermissions: false
            },
            title: 'My Tickets - Support Ticket System'
          },
          {
            path: 'new',
            component: TicketCreateComponent,
            canActivate: [createPermissionGuard([permissionEnum.CREATE_TICKET])],
            title: 'Create New Ticket - Support Ticket System'
          },
          {
            path: 'edit/:ticket_no',
            component: TicketCreateComponent,
            canActivate: [authGuard],
            data: {
              permissions: [
                permissionEnum.EDIT_TICKET, 
                permissionEnum.CHANGE_STATUS,
                permissionEnum.SOLVE_PROBLEM
              ],
              requireAllPermissions: false
            },
            title: 'Edit Ticket - Support Ticket System'
          },
          {
            path: ':ticket_no',
            component: TicketDetailComponent,
            canActivate: [authGuard],
            data: {
              // FIXED: Allow more inclusive access
              permissions: [
                permissionEnum.VIEW_ALL_TICKETS,
                permissionEnum.VIEW_OWN_TICKETS,
                permissionEnum.TRACK_TICKET,
                permissionEnum.CREATE_TICKET  // If user can create, they should view details
              ],
              requireAllPermissions: false
            },
            title: 'Ticket Details - Support Ticket System'
          }
        ]
      },

      // ===== Report Routes - FIXED: More inclusive permissions =====
      {
        path: 'reports',
        children: [
          {
            path: '',
            redirectTo: 'weekly',
            pathMatch: 'full'
          },
          {
            path: 'weekly',
            component: WeeklyReportComponent,
            canActivate: [authGuard],
            data: {
              // FIXED: Allow supporters and admins, but also users who can view their own tickets
              permissions: [
                permissionEnum.VIEW_ALL_TICKETS, 
                permissionEnum.ASSIGN_TO,
                permissionEnum.VIEW_OWN_TICKETS  // Users can see their own reports
              ],
              requireAllPermissions: false
            },
            title: 'Weekly Report - Support Ticket System'
          },
          {
            path: 'monthly',
            component: MonthlyReportComponent,
            canActivate: [authGuard],
            data: {
              permissions: [
                permissionEnum.VIEW_ALL_TICKETS, 
                permissionEnum.ASSIGN_TO,
                permissionEnum.VIEW_OWN_TICKETS  // Users can see their own reports
              ],
              requireAllPermissions: false
            },
            title: 'Monthly Report - Support Ticket System'
          },
          {
            path: 'export',
            component: ExportTicketComponent,
            canActivate: [authGuard],
            data: {
              // Keep this restricted to admin/supporter
              permissions: [permissionEnum.VIEW_ALL_TICKETS],
              requireAllPermissions: true
            },
            title: 'Export Tickets - Support Ticket System'
          }
        ]
      },
      
      // ===== Settings Routes =====
      {
        path: 'settings',
        children: [
          {
            path: '',
            redirectTo: 'general',
            pathMatch: 'full'
          },
          {
            path: 'general',
            component: GeneralComponent,
            // FIXED: No special permissions required for general settings
            title: 'General Settings - Support Ticket System'
          },
          {
            path: 'user-account',
            canActivate: [userManagementGuard],
            component: UserAccountComponent,
            data: {
              permissions: [permissionEnum.ADD_USER, permissionEnum.DEL_USER],
              requireAllPermissions: false
            },
            title: 'User Management - Support Ticket System'
          },
          // ===== UPDATED: Use UserAccountComponent for user creation/editing =====
          {
            path: 'user-create',
            canActivate: [createPermissionGuard([permissionEnum.ADD_USER])],
            component: UserAccountComponent,
            data: {
              permissions: [permissionEnum.ADD_USER],
              requireAllPermissions: true,
              mode: 'create'
            },
            title: 'Create User - Support Ticket System'
          },
          {
            path: 'user-edit/:id',
            canActivate: [createPermissionGuard([permissionEnum.ADD_USER])],
            component: UserAccountComponent,
            data: {
              permissions: [permissionEnum.ADD_USER],
              requireAllPermissions: true,
              mode: 'edit'
            },
            title: 'Edit User - Support Ticket System'
          },
          {
            path: 'project',
            canActivate: [createPermissionGuard([permissionEnum.MANAGE_PROJECT])],
            component: ProjectComponent,
            data: {
              permissions: [permissionEnum.MANAGE_PROJECT],
              requireAllPermissions: true
            },
            title: 'Project Settings - Support Ticket System'
          },
          {
            path: 'ticket-categories',
            canActivate: [adminGuard],
            component: TicketCategoriesComponent,
            data: {
              permissions: [permissionEnum.MANAGE_CATEGORY],
              requireAllPermissions: true
            },
            title: 'Ticket Categories - Support Ticket System'
          },
          {
            path: 'customers',
            canActivate: [adminGuard],
            component: CustomersComponent,
            data: {
              permissions: [permissionEnum.MANAGE_PROJECT],
              requireAllPermissions: true
            },
            title: 'Customers Management - Support Ticket System'
          },
          
          // ===== Customer for Project Routes - UPDATED =====
          {
            path: 'customer-for-project',
            canActivate: [adminGuard],
            loadComponent: () => import('./pages/settings/customer-for-project/customer-for-project.component')
              .then(m => m.CustomerForProjectComponent),
            data: {
              permissions: [permissionEnum.MANAGE_PROJECT],
              requireAllPermissions: true
            },
            title: 'Customer for Project - Support Ticket System'
          },
          // ===== NEW: Project Customer Detail Route =====
          {
            path: 'customer-for-project/:id',
            canActivate: [adminGuard],
            loadComponent: () => import('./pages/settings/project-customer-detail/project-customer-detail.component')
              .then(m => m.ProjectCustomerDetailComponent),
            data: {
              permissions: [permissionEnum.MANAGE_PROJECT],
              requireAllPermissions: true
            },
            title: 'Project Customer Detail - Support Ticket System'
          }
        ]
      },
      
      // ===== Admin Routes =====
      {
        path: 'admin',
        canActivate: [adminGuard],
        children: [
          {
            path: '',
            redirectTo: 'dashboard',
            pathMatch: 'full'
          },
          {
            path: 'dashboard',
            component: DashboardComponent,
            data: {
              permissions: [permissionEnum.ASSIGNEE],
              viewMode: 'admin'
            },
            title: 'Admin Dashboard - Support Ticket System'
          },
          {
            path: 'users',
            component: UserAccountComponent,
            data: {
              permissions: [permissionEnum.ADD_USER, permissionEnum.DEL_USER]
            },
            title: 'User Management - Support Ticket System'
          }
        ]
      },
      
      // ===== Support Team Routes =====
      {
        path: 'support',
        canActivate: [supportGuard],
        children: [
          {
            path: '',
            redirectTo: 'queue',
            pathMatch: 'full'
          },
          {
            path: 'queue',
            component: TicketListComponent,
            data: {
              permissions: [permissionEnum.VIEW_ALL_TICKETS, permissionEnum.ASSIGN_TO],
              viewMode: 'support-queue'
            },
            title: 'Support Queue - Support Ticket System'
          },
          {
            path: 'assigned',
            component: TicketListComponent,
            data: {
              permissions: [permissionEnum.ASSIGN_TO, permissionEnum.SOLVE_PROBLEM],
              viewMode: 'assigned-to-me'
            },
            title: 'Assigned Tickets - Support Ticket System'
          },
          {
            path: 'dashboard',
            component: DashboardComponent,
            data: {
              permissions: [permissionEnum.ASSIGNEE],
              viewMode: 'support'
            },
            title: 'Support Dashboard - Support Ticket System'
          }
        ]
      },
      
      // ===== Simple Routes - FIXED: No special permissions =====
      {
        path: 'access-denied',
        component: DashboardComponent,
        title: 'Access Denied - Support Ticket System'
      }
    ]
  },
  
  // ===== Fallback Route =====
  {
    path: '**',
    redirectTo: '/dashboard'
  }
];

// ===== Route Permission Configuration - UPDATED =====
export const ROUTE_PERMISSIONS = {
  DASHBOARD: {
    VIEW: [] // FIXED: No specific permissions required
  },
  // ✅ NEW: Profile permissions
  PROFILE: {
    VIEW: [], // All authenticated users can view their profile
    EDIT: []  // All authenticated users can edit their own profile
  },
  TICKETS: {
    VIEW_ALL: [permissionEnum.VIEW_ALL_TICKETS],
    VIEW_OWN: [permissionEnum.VIEW_OWN_TICKETS],
    VIEW_ANY: [permissionEnum.VIEW_ALL_TICKETS, permissionEnum.VIEW_OWN_TICKETS, permissionEnum.CREATE_TICKET], // FIXED: More inclusive
    CREATE: [permissionEnum.CREATE_TICKET],
    EDIT: [permissionEnum.EDIT_TICKET, permissionEnum.CHANGE_STATUS],
    DELETE: [permissionEnum.DELETE_TICKET],
    TRACK: [permissionEnum.TRACK_TICKET],
    ASSIGN: [permissionEnum.ASSIGN_TO],
    SOLVE: [permissionEnum.SOLVE_PROBLEM],
    REPLY: [permissionEnum.REPLY_TICKET],
    CLOSE: [permissionEnum.CLOSE_TICKET],
    RESTORE: [permissionEnum.RESTORE_TICKET]
  },
  REPORTS: {
    VIEW: [permissionEnum.VIEW_ALL_TICKETS, permissionEnum.ASSIGN_TO, permissionEnum.VIEW_OWN_TICKETS], // FIXED: More inclusive
    EXPORT: [permissionEnum.VIEW_ALL_TICKETS]
  },
  SETTINGS: {
    GENERAL: [], // FIXED: No special permissions
    USER_MANAGEMENT: [permissionEnum.ADD_USER, permissionEnum.DEL_USER],
    USER_CREATE: [permissionEnum.ADD_USER],
    USER_EDIT: [permissionEnum.ADD_USER],
    PROJECT: [permissionEnum.MANAGE_PROJECT],
    CATEGORIES: [permissionEnum.MANAGE_CATEGORY],
    CUSTOMERS: [permissionEnum.MANAGE_PROJECT],
    CUSTOMER_PROJECT: [permissionEnum.MANAGE_PROJECT],
    CUSTOMER_PROJECT_DETAIL: [permissionEnum.MANAGE_PROJECT], // NEW: Added for detail page
    STATUS: [permissionEnum.MANAGE_STATUS]
  },
  ADMIN: {
    USERS: [permissionEnum.ADD_USER, permissionEnum.DEL_USER],
    SETTINGS: [permissionEnum.MANAGE_PROJECT, permissionEnum.MANAGE_CATEGORY, permissionEnum.MANAGE_STATUS],
  },
  SUPPORT: {
    QUEUE: [permissionEnum.VIEW_ALL_TICKETS, permissionEnum.ASSIGN_TO],
    SOLVE: [permissionEnum.SOLVE_PROBLEM, permissionEnum.REPLY_TICKET],
  },
  SATISFACTION: [permissionEnum.SATISFACTION]
} as const;

// ===== Navigation Helper - UPDATED =====
export interface NavigationItem {
  path: string;
  title: string;
  permissions: number[];
  icon?: string;
  children?: NavigationItem[];
  hidden?: boolean; // NEW: Flag to hide from navigation menu
}

export const NAVIGATION_ITEMS: NavigationItem[] = [
  {
    path: '/dashboard',
    title: 'Dashboard',
    permissions: [], // FIXED: No special permissions required
    icon: 'dashboard'
  },
  {
    path: '/tickets',
    title: 'Tickets',
    // FIXED: More inclusive permissions - any ticket-related permission allows access
    permissions: [
      permissionEnum.VIEW_ALL_TICKETS, 
      permissionEnum.VIEW_OWN_TICKETS, 
      permissionEnum.CREATE_TICKET,
      permissionEnum.TRACK_TICKET
    ],
    icon: 'ticket',
    children: [
      {
        path: '/tickets',
        title: 'All Tickets',
        permissions: [
          permissionEnum.VIEW_ALL_TICKETS,
          permissionEnum.VIEW_OWN_TICKETS,
          permissionEnum.CREATE_TICKET  // FIXED: More inclusive
        ]
      },
      {
        path: '/tickets/my-tickets',
        title: 'My Tickets',
        permissions: [
          permissionEnum.VIEW_OWN_TICKETS,
          permissionEnum.CREATE_TICKET  // FIXED: If can create, should see own tickets
        ]
      },
      {
        path: '/tickets/new',
        title: 'Create Ticket',
        permissions: [permissionEnum.CREATE_TICKET]
      }
    ]
  },
  {
    path: '/reports',
    title: 'Reports',
    // FIXED: Allow users to see reports if they have any view permission
    permissions: [
      permissionEnum.VIEW_ALL_TICKETS,
      permissionEnum.VIEW_OWN_TICKETS,
      permissionEnum.ASSIGN_TO
    ],
    icon: 'report',
    children: [
      {
        path: '/reports/weekly',
        title: 'Weekly Report',
        permissions: [
          permissionEnum.VIEW_ALL_TICKETS,
          permissionEnum.VIEW_OWN_TICKETS  // FIXED: Users can see their own reports
        ]
      },
      {
        path: '/reports/monthly',
        title: 'Monthly Report',
        permissions: [
          permissionEnum.VIEW_ALL_TICKETS,
          permissionEnum.VIEW_OWN_TICKETS  // FIXED: Users can see their own reports
        ]
      },
      {
        path: '/reports/export',
        title: 'Export Tickets',
        permissions: [permissionEnum.VIEW_ALL_TICKETS] // Keep this restricted
      }
    ]
  },
  {
    path: '/settings',
    title: 'Settings',
    permissions: [], // FIXED: Anyone can access settings (but individual pages may be restricted)
    icon: 'settings',
    children: [
      {
        path: '/settings/general',
        title: 'General Settings',
        permissions: [] // FIXED: No special permissions
      },
      {
        path: '/settings/user-account',
        title: 'User Management',
        permissions: [permissionEnum.ADD_USER, permissionEnum.DEL_USER]
      },
      {
        path: '/settings/project',
        title: 'Project Settings',
        permissions: [permissionEnum.MANAGE_PROJECT]
      },
      {
        path: '/settings/ticket-categories',
        title: 'Categories',
        permissions: [permissionEnum.MANAGE_CATEGORY]
      },
      {
        path: '/settings/customers',
        title: 'Customers',
        permissions: [permissionEnum.MANAGE_PROJECT]
      },
      {
        path: '/settings/customer-for-project',
        title: 'Project Customers',
        permissions: [permissionEnum.MANAGE_PROJECT]
      }
      // NOTE: Project Customer Detail is not in navigation menu
      // It's accessed by clicking on a project card
    ]
  }
];

/**
 * Filter navigation items based on user permissions - FIXED: More inclusive logic
 */
export function getAccessibleNavigation(userPermissions: number[]): NavigationItem[] {
  return NAVIGATION_ITEMS.filter(item => {
    // Skip hidden items
    if (item.hidden) {
      return false;
    }
    
    // FIXED: If no permissions required, always allow
    const hasParentAccess = item.permissions.length === 0 || 
      item.permissions.some(p => userPermissions.includes(p));
    
    if (!hasParentAccess) {
      return false;
    }
    
    if (item.children) {
      const accessibleChildren = item.children.filter(child => 
        !child.hidden && (
          child.permissions.length === 0 || 
          child.permissions.some(p => userPermissions.includes(p))
        )
      );
      
      // FIXED: Show parent if it has accessible children OR if parent itself has no permission requirements
      return accessibleChildren.length > 0 || item.permissions.length === 0;
    }
    
    return true;
  }).map(item => ({
    ...item,
    children: item.children?.filter(child => 
      !child.hidden && (
        child.permissions.length === 0 || 
        child.permissions.some(p => userPermissions.includes(p))
      )
    )
  }));
}

/**
 * Check if user can access a specific route
 */
export function canAccessRoute(route: string, userPermissions: number[]): boolean {
  // Find the route in ROUTE_PERMISSIONS
  const routeParts = route.split('/').filter(p => p);
  
  // Special handling for dynamic routes
  if (routeParts.includes('customer-for-project') && routeParts.length > 2) {
    // This is the detail page
    return ROUTE_PERMISSIONS.SETTINGS.CUSTOMER_PROJECT_DETAIL.some(p => 
      userPermissions.includes(p)
    );
  }
  
  // Check other routes normally
  return true;
}
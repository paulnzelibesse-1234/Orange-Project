import { Routes } from '@angular/router';
import { authGuard, guestGuard, roleGuard } from './core/guards';

export const routes: Routes = [
  { path: 'login', canActivate: [guestGuard], loadComponent: () => import('./pages/login').then((m) => m.LoginPage) },
  { path: 'inscription', canActivate: [guestGuard], loadComponent: () => import('./pages/register').then((m) => m.RegisterPage) },
  { path: 'verification', canActivate: [guestGuard], loadComponent: () => import('./pages/verification').then((m) => m.VerificationPage) },
  // Rapport d'intervention A4 à enregistrer en PDF (hors du menu de l'application)
  { path: 'glpi/:id/rapport', canActivate: [authGuard], loadComponent: () => import('./pages/rapport-pdf').then((m) => m.RapportPdfPage) },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell').then((m) => m.Shell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'tableau-de-bord' },
      { path: 'tableau-de-bord', loadComponent: () => import('./pages/dashboard').then((m) => m.DashboardPage) },
      { path: 'mes-signalements', canActivate: [roleGuard('UTILISATEUR')], loadComponent: () => import('./pages/mes-signalements').then((m) => m.MesSignalementsPage) },
      {
        path: 'corbeille-terrain',
        canActivate: [roleGuard('IT', 'RESPONSABLE_IT')],
        loadComponent: () => import('./pages/corbeille-terrain').then((m) => m.CorbeilleTerrainPage),
      },
      {
        path: 'journal-terrain',
        canActivate: [roleGuard('IT', 'RESPONSABLE_IT')],
        loadComponent: () => import('./pages/journal-terrain').then((m) => m.JournalTerrainPage),
      },
      { path: 'glpi', loadComponent: () => import('./pages/tickets-list').then((m) => m.TicketsListPage) },
      { path: 'glpi/nouveau', canActivate: [roleGuard('UTILISATEUR', 'IT')], loadComponent: () => import('./pages/ticket-new').then((m) => m.TicketNewPage) },
      { path: 'glpi/:id', loadComponent: () => import('./pages/ticket-detail').then((m) => m.TicketDetailPage) },
      {
        path: 'utilisateurs',
        canActivate: [roleGuard('RESPONSABLE_IT')],
        loadComponent: () => import('./pages/users').then((m) => m.UsersPage),
      },
      {
        path: 'sites',
        canActivate: [roleGuard('RESPONSABLE_IT')],
        loadComponent: () => import('./pages/sites').then((m) => m.SitesPage),
      },
      {
        path: 'performances',
        canActivate: [roleGuard('RESPONSABLE_IT')],
        loadComponent: () => import('./pages/performances').then((m) => m.PerformancesPage),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];

import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import SignIn from '@/pages/SignIn';
import SignUp from '@/pages/SignUp';
import Onboarding from '@/pages/Onboarding';
import Dashboard from '@/pages/Dashboard';
import AcceptInvite from '@/pages/AcceptInvite';
import SuperAdmin from '@/pages/SuperAdmin';
import Placeholder from '@/pages/Placeholder';
import Billing from '@/pages/Billing';
import BillingCallback from '@/pages/BillingCallback';
import BillingPreview from '@/pages/__preview/BillingPreview';
import UploadPage from '@/pages/Upload';
import Analytics from '@/pages/Analytics';
import SettingsGeneral from '@/pages/SettingsGeneral';
import SettingsTeam from '@/pages/SettingsTeam';
import AnalyticsPreview from '@/pages/__preview/AnalyticsPreview';
import UploadPreview from '@/pages/__preview/UploadPreview';
import SettingsTeamPreview from '@/pages/__preview/SettingsTeamPreview';
import AcceptInvitePreview from '@/pages/__preview/AcceptInvitePreview';
import AdminTenant from '@/pages/AdminTenant';
import AdminTenantPreview from '@/pages/__preview/AdminTenantPreview';
import ImpersonationPreview from '@/pages/__preview/ImpersonationPreview';
import Promotion from '@/pages/Promotion';
import SettingsTeachers from '@/pages/SettingsTeachers';
import SettingsNomenclature from '@/pages/SettingsNomenclature';
import StudentSearch from '@/pages/StudentSearch';
import TeacherAnalytics from '@/pages/TeacherAnalytics';
import NotFound from '@/pages/NotFound';
import PromotionPreview from '@/pages/__preview/PromotionPreview';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AdminProtectedRoute } from '@/components/AdminProtectedRoute';
import AdminLogin from '@/pages/AdminLogin';

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/signin" element={<SignIn />} />
      <Route path="/signup" element={<SignUp />} />
      <Route path="/accept-invite/:token" element={<AcceptInvite />} />
      <Route path="/admin/login" element={<AdminLogin />} />

      {/* Authed */}
      <Route
        path="/onboarding"
        element={
          <ProtectedRoute>
            <Onboarding />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <AdminProtectedRoute>
            <SuperAdmin />
          </AdminProtectedRoute>
        }
      />
      <Route
        path="/admin/tenants/:tenantId"
        element={
          <AdminProtectedRoute>
            <AdminTenant />
          </AdminProtectedRoute>
        }
      />

      {/* Tenant-scoped */}
      <Route
        path="/:tenantSlug/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/:tenantSlug/upload"
        element={
          <ProtectedRoute>
            <UploadPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/:tenantSlug/analytics/igcse"
        element={
          <ProtectedRoute>
            <Analytics examType="igcse" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/:tenantSlug/analytics/alevel"
        element={
          <ProtectedRoute>
            <Analytics examType="alevel" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/:tenantSlug/analytics/students"
        element={
          <ProtectedRoute>
            <StudentSearch />
          </ProtectedRoute>
        }
      />
      <Route
        path="/:tenantSlug/analytics/teachers"
        element={
          <ProtectedRoute>
            <TeacherAnalytics />
          </ProtectedRoute>
        }
      />
      <Route
        path="/:tenantSlug/billing"
        element={
          <ProtectedRoute>
            <Billing />
          </ProtectedRoute>
        }
      />
      <Route
        path="/:tenantSlug/billing/callback"
        element={
          <ProtectedRoute>
            <BillingCallback />
          </ProtectedRoute>
        }
      />
      <Route
        path="/:tenantSlug/settings"
        element={
          <ProtectedRoute>
            <SettingsGeneral />
          </ProtectedRoute>
        }
      />
      <Route
        path="/:tenantSlug/team"
        element={
          <ProtectedRoute>
            <SettingsTeam />
          </ProtectedRoute>
        }
      />
      <Route
        path="/:tenantSlug/teachers"
        element={
          <ProtectedRoute>
            <SettingsTeachers />
          </ProtectedRoute>
        }
      />
      <Route
        path="/:tenantSlug/nomenclature"
        element={
          <ProtectedRoute>
            <SettingsNomenclature />
          </ProtectedRoute>
        }
      />
      {/* Back-compat: old nested /settings/* paths redirect to flat routes */}
      <Route
        path="/:tenantSlug/settings/general"
        element={<RedirectToFlat segment="settings" />}
      />
      <Route
        path="/:tenantSlug/settings/team"
        element={<RedirectToFlat segment="team" />}
      />
      <Route
        path="/:tenantSlug/settings/teachers"
        element={<RedirectToFlat segment="teachers" />}
      />
      <Route
        path="/:tenantSlug/settings/nomenclature"
        element={<RedirectToFlat segment="nomenclature" />}
      />
      <Route
        path="/:tenantSlug/analytics/promotion"
        element={
          <ProtectedRoute>
            <Promotion />
          </ProtectedRoute>
        }
      />

      {/* Dev preview routes — for design verification without DB/auth */}
      {import.meta.env.DEV && (
        <>
          <Route path="/__preview/:tenantSlug/billing" element={<BillingPreview />} />
          <Route path="/__preview/:tenantSlug/upload" element={<UploadPreview />} />
          <Route
            path="/__preview/:tenantSlug/analytics/igcse"
            element={<AnalyticsPreview examType="igcse" />}
          />
          <Route
            path="/__preview/:tenantSlug/analytics/alevel"
            element={<AnalyticsPreview examType="alevel" />}
          />
          <Route
            path="/__preview/:tenantSlug/settings/team"
            element={<SettingsTeamPreview />}
          />
          <Route
            path="/__preview/accept-invite/:token"
            element={<AcceptInvitePreview />}
          />
          <Route
            path="/__preview/admin/tenants/:tenantId"
            element={<AdminTenantPreview />}
          />
          <Route
            path="/__preview/impersonating/:tenantSlug"
            element={<ImpersonationPreview />}
          />
          <Route
            path="/__preview/:tenantSlug/promotion"
            element={<PromotionPreview />}
          />
        </>
      )}

      <Route path="/" element={<Navigate to="/signin" replace />} />
      {/* Authenticated 404 — unauthenticated users still redirect to sign in via ProtectedRoute */}
      <Route
        path="*"
        element={
          <ProtectedRoute>
            <NotFound />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

function RedirectToFlat({ segment }: { segment: string }) {
  const { tenantSlug } = useParams();
  return <Navigate to={`/${tenantSlug}/${segment}`} replace />;
}

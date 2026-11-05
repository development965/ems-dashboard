import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "@/routes/ProtectedRoute";
import { AppLayout } from "@/layouts/AppLayout";
import { PaymentsLayout } from "@/layouts/PaymentsLayout";
import { MastersLayout } from "@/layouts/MastersLayout";
import { ReportsLayout } from "@/layouts/ReportsLayout";
import { LoginPage } from "@/pages/LoginPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { ChangePasswordPage } from "@/pages/ChangePasswordPage";
import { BranchesPage } from "@/pages/BranchesPage";
import { UsersPage } from "@/pages/UsersPage";
import { CoursesPage } from "@/pages/CoursesPage";
import { BatchesPage } from "@/pages/BatchesPage";
import { StudentsPage } from "@/pages/StudentsPage";
import { CreateStudentPage } from "@/pages/CreateStudentPage";
import { StudentDetailPage } from "@/pages/StudentDetailPage";
import { LeadsPage } from "@/pages/LeadsPage";
import { LeadDetailPage } from "@/pages/LeadDetailPage";
import { PaymentsOverviewPage } from "@/pages/PaymentsOverviewPage";
import { PaymentLinksPage } from "@/pages/PaymentLinksPage";
import { RecordPaymentPage } from "@/pages/RecordPaymentPage";
import { PaymentLedgerPage } from "@/pages/PaymentLedgerPage";
import { DiscountsPage } from "@/pages/DiscountsPage";
import { ReportsPage } from "@/pages/ReportsPage";
import { RevenueReportPage } from "@/pages/RevenueReportPage";
import { ReceiptsReportPage } from "@/pages/ReceiptsReportPage";
import { StudentReportPage } from "@/pages/StudentReportPage";
import { OutstandingReportPage } from "@/pages/OutstandingReportPage";
import { PlacementReportPage } from "@/pages/PlacementReportPage";
import { FeeRemindersPage } from "@/pages/FeeRemindersPage";
import { AuditLogPage } from "@/pages/AuditLogPage";
import { TargetsPage } from "@/pages/TargetsPage";
import { BackupPage } from "@/pages/BackupPage";
import { PettyCashPage } from "@/pages/PettyCashPage";
import { RevenueSharesPage } from "@/pages/RevenueSharesPage";
import { OutstandingPage } from "@/pages/OutstandingPage";
import { TransfersPage } from "@/pages/TransfersPage";
import { NotFoundPage } from "@/pages/NotFoundPage";

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/change-password" element={<ChangePasswordPage />} />

          <Route element={<ProtectedRoute allowedRoles={["SUPER_ADMIN", "ACCOUNTANT"]} />}>
            <Route path="/masters" element={<MastersLayout />}>
              <Route index element={<Navigate to="courses" replace />} />
              <Route path="courses" element={<CoursesPage />} />
              <Route path="batches" element={<BatchesPage />} />
            </Route>
          </Route>

          {/* Enrollment records stay with the branch — accountants view a student (e.g. from a
              Payments/Reports link) via the :id route below, but don't get the general list/create. */}
          <Route element={<ProtectedRoute allowedRoles={["SUPER_ADMIN", "BRANCH_ADMIN"]} />}>
            <Route path="/leads" element={<LeadsPage />} />
            <Route path="/leads/:id" element={<LeadDetailPage />} />
            <Route path="/students" element={<StudentsPage />} />
            <Route path="/students/new" element={<CreateStudentPage />} />
          </Route>
          <Route path="/students/:id" element={<StudentDetailPage />} />
          <Route path="/payments" element={<PaymentsLayout />}>
            <Route index element={<PaymentsOverviewPage />} />
            <Route path="links" element={<PaymentLinksPage />} />
            <Route path="record" element={<RecordPaymentPage />} />
            <Route path="ledger" element={<PaymentLedgerPage />} />
            <Route path="revenue-shares" element={<RevenueSharesPage />} />
            <Route path="reminders" element={<FeeRemindersPage />} />
            <Route element={<ProtectedRoute allowedRoles={["SUPER_ADMIN", "ACCOUNTANT"]} />}>
              <Route path="discounts" element={<DiscountsPage />} />
            </Route>
          </Route>
          <Route element={<ProtectedRoute allowedRoles={["SUPER_ADMIN", "BRANCH_ADMIN", "ACCOUNTANT"]} />}>
            <Route path="/petty-cash" element={<PettyCashPage />} />
          </Route>
          <Route path="/outstanding" element={<OutstandingPage />} />
          <Route path="/transfers" element={<TransfersPage />} />
          <Route path="/reports" element={<ReportsLayout />}>
            <Route index element={<ReportsPage />} />
            <Route path="revenue" element={<RevenueReportPage />} />
            <Route path="receipts" element={<ReceiptsReportPage />} />
            <Route path="students" element={<StudentReportPage />} />
            <Route path="outstanding" element={<OutstandingReportPage />} />
            <Route path="placement" element={<PlacementReportPage />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={["SUPER_ADMIN"]} />}>
            <Route path="/branches" element={<BranchesPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/audit-log" element={<AuditLogPage />} />
            <Route path="/targets" element={<TargetsPage />} />
            <Route path="/backup" element={<BackupPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default App;

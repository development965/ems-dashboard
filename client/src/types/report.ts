export interface ReportSummary {
  totals: {
    students: number;
    payments: number;
    feesInvoiced: number;
    revenueCollected: number;
    outstanding: number;
  };
  byBranch: {
    branchId: string;
    branchName: string;
    students: number;
    feesInvoiced: number;
    revenueCollected: number;
    outstanding: number;
  }[];
  byCourse: {
    courseId: string;
    courseName: string;
    courseCode: string;
    students: number;
    feesInvoiced: number;
  }[];
  recentPayments: {
    id: string;
    studentId: string;
    studentName: string;
    amount: number;
    method: string;
    paidAt: string;
  }[];
}

export interface FinanceDashboard {
  ytd: {
    year: number;
    revenue: number;
    paymentsCount: number;
  };
  outstanding: number;
  monthlyTrend: { month: string; year: number; revenue: number }[];
  byMethod: { method: string; revenue: number }[];
  byBranch: { branchId: string; branchName: string; revenue: number }[];
  byCourse: { courseId: string; courseName: string; revenue: number }[];
}

export interface RevenueConsole {
  ytd: {
    year: number;
    startLabel: string;
    endLabel: string;
    revenue: number;
    paymentsCount: number;
    avgPerPayment: number;
    discountsGiven: number;
    discountPctOfBilled: number;
  };
  branches: { id: string; name: string }[];
  monthlyByBranch: { month: string; year: number; byBranch: Record<string, number>; total: number }[];
  ytdCumulativeByBranch: { month: string; year: number; byBranch: Record<string, number>; total: number }[];
  branchShare: { branchId: string; branchName: string; revenue: number }[];
  byMethod: { method: string; revenue: number }[];
  ytdTableByBranch: {
    branchId: string;
    branchName: string;
    payments: number;
    discount: number;
    revenue: number;
    sharePct: number;
  }[];
  topCourses: { courseId: string; courseName: string; payments: number; discount: number; revenue: number }[];
}

export interface RevenueReport {
  from: string;
  to: string;
  branches: { branchId: string; branchName: string; revenue: number; payments: number; outstanding: number }[];
  totals: { revenue: number; payments: number; outstanding: number };
}

export interface ReceiptsReport {
  from: string | null;
  to: string | null;
  rows: {
    paymentId: string;
    paidAt: string;
    studentId: string;
    studentName: string;
    studentPhone: string;
    branchId: string;
    branchName: string;
    courseName: string;
    amount: number;
    method: string;
    recordedByName: string;
    notes: string | null;
  }[];
  discountRows: {
    discountId: string;
    createdAt: string;
    studentId: string;
    studentName: string;
    branchId: string;
    branchName: string;
    courseName: string;
    amount: number;
    reason: string;
  }[];
  totals: { revenue: number; receipts: number; discounts: number };
}

export interface StudentReport {
  from: string | null;
  to: string | null;
  totals: { total: number; enrolled: number; completed: number; dropped: number };
  byBranch: { branchId: string; branchName: string; total: number; enrolled: number; completed: number; dropped: number }[];
  byCourse: { courseId: string; courseName: string; total: number }[];
  byMode: { mode: string; total: number }[];
  monthlyEnrollments: { month: string; year: number; count: number }[];
}

export interface OutstandingReport {
  students: {
    studentId: string;
    studentName: string;
    phone: string;
    branchId: string;
    branchName: string;
    courseName: string;
    netFee: number;
    paid: number;
    balanceDue: number;
    enrolledAt: string;
  }[];
  totalOutstanding: number;
  studentsWithDues: number;
}

export interface PlacementReport {
  students: {
    studentId: string;
    studentName: string;
    phone: string;
    branchId: string;
    branchName: string;
    courseName: string;
    certificationStatus: "NOT_ISSUED" | "ISSUED";
    certificateNo: string | null;
    certificateIssuedAt: string | null;
    placementStatus: "NOT_PLACED" | "IN_PROGRESS" | "PLACED";
    placementCompany: string | null;
    placementRole: string | null;
    placementPackageLPA: number | null;
    placedAt: string | null;
  }[];
  totals: { students: number; certified: number; placed: number; placementInProgress: number };
  byBranch: { branchId: string; branchName: string; students: number; certified: number; placed: number }[];
}
